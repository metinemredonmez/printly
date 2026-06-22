import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNumber, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { CreditsService } from './credits.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class TopUpDto {
  @IsNumber() @Min(1) amount: number;
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

  // Kendi bakiyeni yükle (kart ile simüle). $250+ → %40 indirim hakkı.
  @Post('me/topup')
  topUp(@CurrentUser() user: AuthUser, @Body() dto: TopUpDto) {
    return this.credits.topUp(user.userId, dto.amount);
  }

  // Admin: bir kullanıcıya bakiye yükle
  @Roles(Role.ADMIN)
  @Post(':userId/topup')
  adminTopUp(@Param('userId') userId: string, @Body() dto: TopUpDto) {
    return this.credits.topUp(userId, dto.amount);
  }
}
