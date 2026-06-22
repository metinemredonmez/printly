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
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { multiplierForRole } from '../common/pricing.util';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  priceMultiplier: true,
  balance: true,
  hasDiscount40: true,
  isEmailVerified: true,
  twoFactorEnabled: true,
  active: true,
  organizationId: true,
  leaderId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

class CreateStaffDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() fullName?: string;
  @IsEnum(Role) role: Role;
}
class UpdateRoleDto {
  @IsEnum(Role) role: Role;
}
class UpdateActiveDto {
  @IsBoolean() active: boolean;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list(search?: string, role?: Role) {
    return this.prisma.user.findMany({
      where: {
        role: role || undefined,
        OR: search
          ? [
              { email: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: { ...SAFE_SELECT, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { ...SAFE_SELECT, _count: { select: { orders: true } } },
    });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    return u;
  }

  // Admin personel oluşturur (ADMIN/PRODUCTION/TRAINER vb.) — doğrudan doğrulanmış
  async createStaff(actor: AuthUser, dto: CreateStaffDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Bu e-posta zaten kayıtlı');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName,
        role: dto.role,
        priceMultiplier: multiplierForRole(dto.role),
        isEmailVerified: true,
      },
      select: SAFE_SELECT,
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user.id,
      meta: { role: dto.role },
    });
    return user;
  }

  async setRole(actor: AuthUser, id: string, role: Role) {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { role, priceMultiplier: multiplierForRole(role) },
      select: SAFE_SELECT,
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: id,
      meta: { role },
    });
    return user;
  }

  async setActive(actor: AuthUser, id: string, active: boolean) {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { active },
      select: SAFE_SELECT,
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'USER_ACTIVE_CHANGE',
      entityType: 'User',
      entityId: id,
      meta: { active },
    });
    return user;
  }
}

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query('search') search?: string, @Query('role') role?: Role) {
    return this.users.list(search, role);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateStaffDto) {
    return this.users.createStaff(actor, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/role')
  setRole(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.users.setRole(actor, id, dto.role);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/active')
  setActive(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateActiveDto) {
    return this.users.setActive(actor, id, dto.active);
  }
}

@Module({
  providers: [AdminUsersService],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
