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
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsObject,
} from 'class-validator';
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
  ) {}

  // ── Cihaz kaydı (push) ─────────────────────
  registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.userDevice.upsert({
      where: { deviceToken: dto.deviceToken },
      update: { userId, platform: dto.platform, isActive: true, lastActiveAt: new Date() },
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

  // ── Toplu e-posta (SMTP) ───────────────────
  async sendBulkEmail(actor: AuthUser, dto: BulkEmailDto) {
    let recipients: string[] = [];
    if (dto.targetType === 'ALL') {
      const users = await this.prisma.user.findMany({
        where: { active: true },
        select: { email: true },
      });
      recipients = users.map((u) => u.email);
    } else if (dto.targetType === 'USER_IDS') {
      const users = await this.prisma.user.findMany({
        where: { id: { in: dto.userIds ?? [] } },
        select: { email: true },
      });
      recipients = users.map((u) => u.email);
    } else {
      recipients = dto.emails ?? [];
    }

    const result = await this.mail.sendBulk(recipients, dto.subject, dto.html);
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'EMAIL_BULK',
      entityType: 'Email',
      meta: { targetType: dto.targetType, ...result },
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

@Module({
  providers: [NotificationsService, OneSignalProvider],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
