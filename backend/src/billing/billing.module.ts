import {
  Module,
  Injectable,
  Controller,
  Get,
  Put,
  Body,
} from '@nestjs/common';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BillingCountry, BillingType, BillingInfo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, safeDecrypt } from '../common/crypto.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

// At-rest şifrelenecek hassas kimlik alanları
const SENSITIVE: (keyof BillingInfo)[] = ['tc', 'ssn', 'ein', 'taxNo'];

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

  async get(userId: string) {
    const row = await this.prisma.billingInfo.findUnique({ where: { userId } });
    return row ? this.decryptRow(row) : row;
  }

  // Tek kayıt; varsa güncelle yoksa oluştur. Hassas alanlar şifreli saklanır.
  async upsert(userId: string, dto: BillingDto) {
    const data = this.encryptDto(dto);
    const row = await this.prisma.billingInfo.upsert({
      where: { userId },
      create: { ...data, userId },
      update: { ...data },
    });
    return this.decryptRow(row); // sahibine düz metin döndür
  }

  private encryptDto(dto: BillingDto): BillingDto {
    const out: any = { ...dto };
    for (const f of SENSITIVE) {
      if (out[f]) out[f] = encrypt(String(out[f]));
    }
    return out;
  }

  private decryptRow(row: BillingInfo): BillingInfo {
    const out: any = { ...row };
    for (const f of SENSITIVE) {
      if (out[f]) out[f] = safeDecrypt(out[f]);
    }
    return out;
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
