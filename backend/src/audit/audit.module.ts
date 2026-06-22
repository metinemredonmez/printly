import {
  Global,
  Module,
  Injectable,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';

export interface AuditEntry {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // Denetim kaydı. Hata olsa bile ana akışı bozmaz (best-effort).
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId ?? undefined,
          actorRole: entry.actorRole ?? undefined,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          meta: entry.meta as Prisma.InputJsonValue,
        },
      });
    } catch {
      // audit log yazımı ana işlemi engellemez
    }
  }

  list(filter: { action?: string; entityType?: string; entityId?: string; take?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        action: filter.action,
        entityType: filter.entityType,
        entityId: filter.entityId,
      },
      orderBy: { createdAt: 'desc' },
      // Güvenli take: NaN/negatif/0 → varsayılan 100, üst sınır 500 (M3)
      take:
        Number.isFinite(filter.take) && (filter.take as number) > 0
          ? Math.min(filter.take as number, 500)
          : 100,
    });
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      action,
      entityType,
      entityId,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}

@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
