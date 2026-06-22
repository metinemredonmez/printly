import {
  Global,
  Module,
  Injectable,
  Controller,
  Get,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { IsDefined } from 'class-validator';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class SetSettingDto {
  // value zorunlu (eksikse Prisma 500 + kaynak yolu sızıntısı yerine net 400 — M2)
  @IsDefined() value: unknown;
}

// Varsayılan ayarlar (DB'de yoksa bunlar döner)
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  activePaymentProvider: 'QUICKBOOKS', // QUICKBOOKS | STRIPE
  paymentProvidersEnabled: { QUICKBOOKS: true, STRIPE: false },
  features: { aiChatbox: false, virtualTryOn: false, kanban: true, push: false },
  membershipFee: 30,
  bulkLoadForDiscount: 250,
  discountRate: 0.4,
};

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async get<T = unknown>(key: string, fallback?: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (row) return row.value as T;
    return (fallback ?? (DEFAULT_SETTINGS[key] as T));
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany();
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) merged[r.key] = r.value;
    return merged;
  }

  async set(key: string, value: unknown, actor?: AuthUser) {
    const row = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    await this.audit.log({
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      action: 'SETTING_UPDATE',
      entityType: 'Setting',
      entityId: key,
      meta: { value },
    });
    return row;
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Roles(Role.ADMIN)
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Roles(Role.ADMIN)
  @Get(':key')
  async getOne(@Param('key') key: string) {
    return { key, value: await this.settings.get(key) };
  }

  @Roles(Role.ADMIN)
  @Put(':key')
  set(
    @Param('key') key: string,
    @Body() dto: SetSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.set(key, dto.value, user);
  }
}

@Global()
@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
