import {
  Module,
  Injectable,
  Controller,
  Post,
  OnModuleInit,
} from '@nestjs/common';
import {
  BullModule,
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { Prisma, Role, TransactionType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { MEMBERSHIP_FEE } from '../common/pricing.util';
import { Roles } from '../common/decorators/roles.decorator';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger('Subscriptions');

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Vadesi geçen Ekip Üyeliği aidatlarını işle (#32):
  // bakiye yeterse $30 atomik düş + 30 gün uzat; yetmezse üyeliği düşür.
  async renewDueMemberships() {
    const due = await this.prisma.membership.findMany({
      where: {
        active: true,
        tier: Role.TEAM_MEMBER,
        renewalDate: { lt: new Date() },
      },
    });

    let charged = 0;
    let downgraded = 0;
    for (const m of due) {
      const affected = await this.prisma.$executeRaw`UPDATE "User" SET balance = balance - ${MEMBERSHIP_FEE}::numeric WHERE id = ${m.userId} AND balance >= ${MEMBERSHIP_FEE}::numeric`;
      if (affected === 1) {
        const u = await this.prisma.user.findUnique({
          where: { id: m.userId },
          select: { balance: true },
        });
        const next = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await this.prisma.$transaction([
          this.prisma.membership.update({
            where: { userId: m.userId },
            data: { renewalDate: next },
          }),
          this.prisma.creditLedger.create({
            data: {
              userId: m.userId,
              delta: new Prisma.Decimal(-MEMBERSHIP_FEE),
              balanceAfter: new Prisma.Decimal(Number(u?.balance ?? 0)),
              reason: 'Ekip Üyeliği aidatı (otomatik yenileme)',
            },
          }),
          this.prisma.transaction.create({
            data: {
              userId: m.userId,
              type: TransactionType.MEMBERSHIP_FEE,
              amount: new Prisma.Decimal(MEMBERSHIP_FEE),
              method: PaymentMethod.BALANCE,
              note: 'Otomatik aidat yenileme',
            },
          }),
        ]);
        charged++;
      } else {
        // Yetersiz bakiye → üyeliği pasifle + USER'a düşür (2× fiyat)
        await this.prisma.$transaction([
          this.prisma.membership.update({
            where: { userId: m.userId },
            data: { active: false },
          }),
          this.prisma.user.update({
            where: { id: m.userId },
            data: { role: Role.USER, priceMultiplier: 2, leaderId: null },
          }),
        ]);
        await this.audit.log({
          action: 'MEMBERSHIP_LAPSED',
          entityType: 'User',
          entityId: m.userId,
          meta: { reason: 'Yetersiz bakiye — aidat tahsil edilemedi' },
        });
        downgraded++;
      }
    }
    this.logger.log(
      `Aidat yenileme: ${due.length} vade, ${charged} tahsil, ${downgraded} düşürüldü`,
    );
    return { due: due.length, charged, downgraded };
  }
}

@Processor('subscriptions')
export class SubscriptionsProcessor extends WorkerHost {
  constructor(private readonly svc: SubscriptionsService) {
    super();
  }
  async process(job: Job) {
    if (job.name === 'renew-due') return this.svc.renewDueMemberships();
    return undefined;
  }
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly svc: SubscriptionsService,
    @InjectQueue('subscriptions') private queue: Queue,
  ) {}

  // Admin: yenilemeyi elle tetikle (test/operasyon)
  @Roles(Role.ADMIN)
  @Post('run-renewal')
  run() {
    return this.svc.renewDueMemberships();
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: 'subscriptions' })],
  providers: [SubscriptionsService, SubscriptionsProcessor],
  controllers: [SubscriptionsController],
})
export class SubscriptionsModule implements OnModuleInit {
  constructor(@InjectQueue('subscriptions') private queue: Queue) {}

  // Günlük tekrarlı job (her gün 03:00) — vadesi geçen aidatları işler
  async onModuleInit() {
    await this.queue.add(
      'renew-due',
      {},
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: 'daily-membership-renewal', // tekilleştir
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );
  }
}
