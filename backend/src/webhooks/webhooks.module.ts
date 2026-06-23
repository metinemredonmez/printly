import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  BullModule,
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { IsString, IsArray, IsUrl, IsOptional } from 'class-validator';
import { createHmac } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class CreateSubscriptionDto {
  @IsUrl({ require_tld: false }) url: string;
  @IsArray() @IsString({ each: true }) events: string[];
  @IsOptional() @IsString() secret?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhooks') private queue: Queue,
  ) {}

  async createSubscription(user: AuthUser, dto: CreateSubscriptionDto) {
    const secret = dto.secret || createHmac('sha256', `${user.userId}:${Date.now()}`).update('seed').digest('hex');
    return this.prisma.webhookSubscription.create({
      data: {
        userId: user.userId,
        organizationId: user.organizationId ?? undefined,
        url: dto.url,
        events: dto.events,
        secret,
      },
    });
  }

  list(user: AuthUser) {
    return this.prisma.webhookSubscription.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(user: AuthUser, id: string) {
    const sub = await this.prisma.webhookSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Abonelik bulunamadı');
    if (sub.userId !== user.userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Erişiminiz yok');
    }
    await this.prisma.webhookSubscription.delete({ where: { id } });
    return { deleted: true };
  }

  // Bir olayı, ilgili bayinin/firma'nın eşleşen aboneliklerine imzalı gönder
  async dispatch(
    event: string,
    target: { userId?: string; organizationId?: string | null },
    payload: Record<string, unknown>,
  ) {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: {
        active: true,
        events: { has: event },
        OR: [
          ...(target.userId ? [{ userId: target.userId }] : []),
          ...(target.organizationId ? [{ organizationId: target.organizationId }] : []),
        ],
      },
    });
    for (const sub of subs) {
      await this.queue.add(
        'deliver',
        { url: sub.url, secret: sub.secret, event, payload },
        { attempts: 5, backoff: { type: 'exponential', delay: 3000 } },
      );
    }
    return { dispatched: subs.length };
  }
}

@Processor('webhooks')
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger('WebhooksDelivery');

  async process(job: Job) {
    const { url, secret, event, payload } = job.data as {
      url: string;
      secret: string;
      event: string;
      payload: unknown;
    };
    const body = JSON.stringify({ event, data: payload, ts: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Webhook ${url} → HTTP ${res.status}`); // BullMQ retry tetikler
    }
    return { delivered: true, status: res.status };
  }
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Post('subscriptions')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.svc.createSubscription(user, dto);
  }

  @Get('subscriptions')
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user);
  }

  @Delete('subscriptions/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.remove(user, id);
  }

  // Test: kendi aboneliklerine örnek olay gönder
  @Post('test')
  test(@CurrentUser() user: AuthUser) {
    return this.svc.dispatch(
      'test.ping',
      { userId: user.userId, organizationId: user.organizationId },
      { message: 'Ortak Doku webhook testi', at: new Date().toISOString() },
    );
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: 'webhooks' })],
  providers: [WebhooksService, WebhooksProcessor],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
