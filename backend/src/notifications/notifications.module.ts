import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsObject,
} from 'class-validator';
import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.module';
import { OneSignalProvider } from './onesignal.provider';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class RegisterDeviceDto {
  @IsString() deviceToken: string;
  @IsIn(['IOS', 'ANDROID', 'WEB']) platform: string;
}

class SendPushDto {
  @IsString() title: string;
  @IsString() body: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsIn(['ALL', 'USER_IDS', 'SEGMENT']) targetType: 'ALL' | 'USER_IDS' | 'SEGMENT';
  @IsOptional() @IsArray() userIds?: string[];
  @IsOptional() @IsString() segment?: string;
  @IsOptional() @IsString() imageUrl?: string;
}

class BulkEmailDto {
  @IsString() subject: string;
  @IsString() html: string;
  @IsIn(['ALL', 'USER_IDS', 'EMAILS']) targetType: 'ALL' | 'USER_IDS' | 'EMAILS';
  @IsOptional() @IsArray() userIds?: string[];
  @IsOptional() @IsArray() emails?: string[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private audit: AuditService,
    private onesignal: OneSignalProvider,
    @InjectQueue('notifications') private queue: Queue,
  ) {}

  // ── Cihaz kaydı (push) ─────────────────────
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    // Hijack koruması (H2): token başka bir hesaba kayıtlıysa devralma reddedilir;
    // upsert update dalında da userId DEĞİŞTİRİLMEZ. (Push token cihaza özgü ve opak.)
    const existing = await this.prisma.userDevice.findUnique({
      where: { deviceToken: dto.deviceToken },
    });
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException('Bu cihaz başka bir hesaba kayıtlı');
    }
    return this.prisma.userDevice.upsert({
      where: { deviceToken: dto.deviceToken },
      update: { platform: dto.platform, isActive: true, lastActiveAt: new Date() },
      create: { userId, deviceToken: dto.deviceToken, platform: dto.platform },
    });
  }

  listDevices(userId: string) {
    return this.prisma.userDevice.findMany({ where: { userId, isActive: true } });
  }

  async removeDevice(userId: string, id: string) {
    const d = await this.prisma.userDevice.findUnique({ where: { id } });
    if (!d || d.userId !== userId) throw new NotFoundException('Cihaz bulunamadı');
    return this.prisma.userDevice.delete({ where: { id } });
  }

  // ── Push gönder (toplu/broadcast) ──────────
  async sendPush(actor: AuthUser, dto: SendPushDto) {
    const log = await this.prisma.pushNotificationLog.create({
      data: {
        title: dto.title,
        body: dto.body,
        data: dto.data as any,
        targetType: dto.targetType,
        targetIds: dto.userIds ?? [],
        createdByUserId: actor.userId,
      },
    });

    let playerIds: string[] = [];
    let segments: string[] | undefined;
    if (dto.targetType === 'ALL') {
      segments = ['Subscribed Users'];
    } else if (dto.targetType === 'SEGMENT') {
      segments = [dto.segment ?? 'Subscribed Users'];
    } else {
      const devices = await this.prisma.userDevice.findMany({
        where: { userId: { in: dto.userIds ?? [] }, isActive: true },
        select: { deviceToken: true },
      });
      playerIds = devices.map((d) => d.deviceToken);
    }

    const r = await this.onesignal.send({
      title: dto.title,
      body: dto.body,
      data: dto.data,
      imageUrl: dto.imageUrl,
      playerIds,
      segments,
    });

    const updated = await this.prisma.pushNotificationLog.update({
      where: { id: log.id },
      data: {
        status: r.ok ? 'SENT' : 'FAILED',
        providerMsgId: r.id,
        totalRecipients: r.recipients,
        successCount: r.ok ? r.recipients : 0,
        failureCount: r.ok ? 0 : 1,
        errorMessage: r.error,
        sentAt: new Date(),
      },
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'PUSH_SEND',
      entityType: 'PushNotificationLog',
      entityId: log.id,
      meta: { targetType: dto.targetType, ok: r.ok, recipients: r.recipients },
    });
    return updated;
  }

  // ── Toplu e-posta (SMTP) → BullMQ kuyruğuna al ─────
  async sendBulkEmail(actor: AuthUser, dto: BulkEmailDto) {
    const job = await this.queue.add('bulk-email', {
      targetType: dto.targetType,
      userIds: dto.userIds,
      emails: dto.emails,
      subject: dto.subject,
      html: dto.html,
      actorUserId: actor.userId,
      actorRole: actor.role,
    });
    return { queued: true, jobId: job.id };
  }

  // Worker tarafından çalıştırılır (gerçek gönderim)
  async processBulkEmail(data: any) {
    let recipients: string[] = [];
    if (data.targetType === 'ALL') {
      const users = await this.prisma.user.findMany({ where: { active: true }, select: { email: true } });
      recipients = users.map((u) => u.email);
    } else if (data.targetType === 'USER_IDS') {
      const users = await this.prisma.user.findMany({ where: { id: { in: data.userIds ?? [] } }, select: { email: true } });
      recipients = users.map((u) => u.email);
    } else {
      recipients = data.emails ?? [];
    }
    const result = await this.mail.sendBulk(recipients, data.subject, data.html);
    await this.audit.log({
      actorUserId: data.actorUserId,
      actorRole: data.actorRole,
      action: 'EMAIL_BULK',
      entityType: 'Email',
      meta: { targetType: data.targetType, ...result, queued: true },
    });
    return { ...result, total: recipients.length };
  }

  pushLogs() {
    return this.prisma.pushNotificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notif: NotificationsService) {}

  // Cihaz (kullanıcı)
  @Post('devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.notif.registerDevice(user.userId, dto);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.notif.listDevices(user.userId);
  }

  @Delete('devices/:id')
  removeDevice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notif.removeDevice(user.userId, id);
  }

  // Gönderim (admin)
  @Roles(Role.ADMIN)
  @Post('push')
  sendPush(@CurrentUser() user: AuthUser, @Body() dto: SendPushDto) {
    return this.notif.sendPush(user, dto);
  }

  @Roles(Role.ADMIN)
  @Post('email-bulk')
  sendBulkEmail(@CurrentUser() user: AuthUser, @Body() dto: BulkEmailDto) {
    return this.notif.sendBulkEmail(user, dto);
  }

  @Roles(Role.ADMIN)
  @Get('push-logs')
  pushLogs() {
    return this.notif.pushLogs();
  }
}

// BullMQ worker — kuyruktaki işleri işler
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly svc: NotificationsService) {
    super();
  }
  async process(job: Job) {
    if (job.name === 'bulk-email') return this.svc.processBulkEmail(job.data);
    return undefined;
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  providers: [NotificationsService, OneSignalProvider, NotificationsProcessor],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
