import { Body, Controller, Post } from '@nestjs/common';
import {
  IsInt,
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { multiplierForRole } from '../common/pricing.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class QuoteItemDto {
  @IsString() productId: string;
  @IsNumber() @Min(0) widthInch: number;
  @IsNumber() @Min(0) heightInch: number;
  @IsInt() @Min(1) quantity: number;
}

class QuoteExtraDto {
  @IsString() extraOptionId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
}

class QuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteExtraDto)
  extras?: QuoteExtraDto[];
}

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
  ) {}

  // Canlı fiyat önizleme — kullanıcının rol çarpanı + %40 durumuna göre.
  @Post('quote')
  async quote(@Body() dto: QuoteDto, @CurrentUser() user: AuthUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { priceMultiplier: true, hasDiscount40: true, role: true },
    });
    const multiplier = dbUser?.priceMultiplier ?? multiplierForRole(user.role);
    const hasDiscount40 = dbUser?.hasDiscount40 ?? false;
    return this.pricing.quoteOrder(
      dto.items,
      dto.extras ?? [],
      multiplier,
      hasDiscount40,
    );
  }
}
