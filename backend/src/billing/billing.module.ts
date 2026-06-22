import {
  Module,
  Injectable,
  Controller,
  Get,
  Put,
  Body,
} from '@nestjs/common';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BillingCountry, BillingType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class BillingDto {
  @IsEnum(BillingCountry) country: BillingCountry;
  @IsEnum(BillingType) type: BillingType;
  @IsOptional() @IsString() address?: string;
  // TR
  @IsOptional() @IsString() tc?: string;
  @IsOptional() @IsString() companyTitle?: string;
  @IsOptional() @IsString() taxOffice?: string;
  @IsOptional() @IsString() taxNo?: string;
  // US
  @IsOptional() @IsString() ssn?: string;
  @IsOptional() @IsString() ein?: string;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  get(userId: string) {
    return this.prisma.billingInfo.findUnique({ where: { userId } });
  }

  // Tek kayıt; varsa güncelle yoksa oluştur.
  upsert(userId: string, dto: BillingDto) {
    return this.prisma.billingInfo.upsert({
      where: { userId },
      create: { ...dto, userId },
      update: { ...dto },
    });
  }
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('me')
  get(@CurrentUser() user: AuthUser) {
    return this.billing.get(user.userId);
  }

  @Put('me')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: BillingDto) {
    return this.billing.upsert(user.userId, dto);
  }
}

@Module({
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
