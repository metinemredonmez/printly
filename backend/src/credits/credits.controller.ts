import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, Min, Max } from 'class-validator';
import { Role } from '@prisma/client';
import { CreditsService } from './credits.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class TopUpDto {
  // 2 ondalık, 1–100.000 USD aralığı (Decimal(12,2) taşması + saçma tutar koruması)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100000) amount: number;
}

@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get('me')
  myBalance(@CurrentUser() user: AuthUser) {
    return this.credits.balance(user.userId);
  }

  @Get('me/ledger')
  myLedger(@CurrentUser() user: AuthUser) {
    return this.credits.ledger(user.userId);
  }

  // Kendi bakiyeni yükleme TALEBİ (PENDING). Bakiye/indirim ödeme onayından sonra işlenir.
  @Post('me/topup')
  requestTopUp(@CurrentUser() user: AuthUser, @Body() dto: TopUpDto) {
    return this.credits.requestTopUp(user.userId, dto.amount);
  }

  // Admin / ödeme webhook'u: PENDING yükleme talebini onayla → bakiyeye işle
  @Roles(Role.ADMIN)
  @Post('topup/:transactionId/confirm')
  confirmTopUp(
    @CurrentUser() admin: AuthUser,
    @Param('transactionId') transactionId: string,
  ) {
    return this.credits.confirmTopUp(admin.userId, transactionId);
  }

  // Admin: bir kullanıcıya bakiyeyi ANINDA yükle (tahsilat yapıldı varsayımı)
  @Roles(Role.ADMIN)
  @Post(':userId/topup')
  adminTopUp(
    @CurrentUser() admin: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: TopUpDto,
  ) {
    return this.credits.topUp(userId, dto.amount, undefined, admin.userId);
  }
}
