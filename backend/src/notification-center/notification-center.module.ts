import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class PrefsDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() orderUpdates?: boolean;
  @IsOptional() @IsBoolean() marketing?: boolean;
}

@Injectable()
export class NotificationCenterService {
  constructor(private prisma: PrismaService) {}

  // Sistem/diğer modüller bunu çağırarak in-app bildirim oluşturur
  async notify(
    userId: string,
    type: string,
    title: string,
    body?: string,
    data?: Prisma.InputJsonValue,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
  }

  list(userId: string, take = 30, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unread: count };
  }

  async markRead(userId: string, id: string) {
    // updateMany ile sahiplik garanti (başkasının bildirimini okutamaz)
    const res = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async getPrefs(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    // yoksa varsayılan oluştur
    return this.prisma.notificationPreference.create({ data: { userId } });
  }

  async updatePrefs(userId: string, dto: PrefsDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }
}

@Controller('notifications')
export class NotificationCenterController {
  constructor(private readonly svc: NotificationCenterService) {}

  @Get('center')
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('unread') unread?: string,
  ) {
    const n = take ? parseInt(take, 10) : 30;
    return this.svc.list(user.userId, Number.isFinite(n) ? n : 30, unread === 'true');
  }

  @Get('center/unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.svc.unreadCount(user.userId);
  }

  @Post('center/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.markRead(user.userId, id);
  }

  @Post('center/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.svc.markAllRead(user.userId);
  }

  @Get('preferences')
  getPrefs(@CurrentUser() user: AuthUser) {
    return this.svc.getPrefs(user.userId);
  }

  @Patch('preferences')
  updatePrefs(@CurrentUser() user: AuthUser, @Body() dto: PrefsDto) {
    return this.svc.updatePrefs(user.userId, dto);
  }
}

@Module({
  providers: [NotificationCenterService],
  controllers: [NotificationCenterController],
  exports: [NotificationCenterService],
})
export class NotificationCenterModule {}
