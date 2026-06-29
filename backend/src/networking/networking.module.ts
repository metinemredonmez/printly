import {
  Module,
  Injectable,
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsArray, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class UpsertProfileDto {
  @IsString() @MinLength(2) displayName: string;
  @IsOptional() @IsString() headline?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsArray() expertise?: string[];
  @IsOptional() @IsBoolean() visible?: boolean;
}

@Injectable()
export class NetworkingService {
  constructor(private prisma: PrismaService) {}

  // Görünür üye dizini (arama destekli)
  directory(q?: string) {
    return this.prisma.networkProfile.findMany({
      where: {
        visible: true,
        ...(q
          ? {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { headline: { contains: q, mode: 'insensitive' } },
                { company: { contains: q, mode: 'insensitive' } },
                { expertise: { has: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        displayName: true,
        headline: true,
        bio: true,
        company: true,
        website: true,
        location: true,
        expertise: true,
        createdAt: true,
      },
    });
  }

  async getMine(user: AuthUser) {
    return this.prisma.networkProfile.findUnique({ where: { userId: user.userId } });
  }

  async upsertMine(user: AuthUser, dto: UpsertProfileDto) {
    return this.prisma.networkProfile.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        displayName: dto.displayName,
        headline: dto.headline,
        bio: dto.bio,
        company: dto.company,
        website: dto.website,
        location: dto.location,
        expertise: dto.expertise ?? [],
        visible: dto.visible ?? true,
      },
      update: {
        displayName: dto.displayName,
        headline: dto.headline,
        bio: dto.bio,
        company: dto.company,
        website: dto.website,
        location: dto.location,
        expertise: dto.expertise ?? [],
        visible: dto.visible ?? true,
      },
    });
  }

  async getOne(id: string) {
    const p = await this.prisma.networkProfile.findFirst({
      where: { id, visible: true },
      select: {
        id: true,
        displayName: true,
        headline: true,
        bio: true,
        company: true,
        website: true,
        location: true,
        expertise: true,
        createdAt: true,
      },
    });
    if (!p) throw new NotFoundException('Profil bulunamadı');
    return p;
  }
}

@Controller('network')
export class NetworkingController {
  constructor(private readonly svc: NetworkingService) {}

  @Get()
  directory(@Query('q') q?: string) {
    return this.svc.directory(q);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.svc.getMine(user);
  }

  @Put('me')
  upsertMine(@CurrentUser() user: AuthUser, @Body() dto: UpsertProfileDto) {
    return this.svc.upsertMine(user, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }
}

@Module({
  providers: [NetworkingService],
  controllers: [NetworkingController],
})
export class NetworkingModule {}
