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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { Role, ConsultingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

// Danışmanlık durum geçişleri (geçersiz/geri geçişleri engelle)
const CONSULTING_TRANSITIONS: Record<ConsultingStatus, ConsultingStatus[]> = {
  PENDING: [ConsultingStatus.SCHEDULED, ConsultingStatus.CANCELLED],
  SCHEDULED: [ConsultingStatus.COMPLETED, ConsultingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

function isStaff(role: Role) {
  return role === Role.ADMIN || role === Role.PRODUCTION;
}

class CreateConsultingDto {
  @IsString() @MinLength(3) topic: string;
  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsDateString() preferredAt?: string;
}

class UpdateConsultingDto {
  @IsOptional() @IsEnum(ConsultingStatus) status?: ConsultingStatus;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() meetingUrl?: string;
  @IsOptional() @IsString() adminNote?: string;
}

@Injectable()
export class ConsultingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(user: AuthUser, dto: CreateConsultingDto) {
    const req = await this.prisma.consultingRequest.create({
      data: {
        userId: user.userId,
        topic: dto.topic,
        details: dto.details,
        preferredAt: dto.preferredAt ? new Date(dto.preferredAt) : undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'CONSULTING_REQUEST',
      entityType: 'ConsultingRequest',
      entityId: req.id,
      meta: { topic: req.topic },
    });
    return req;
  }

  async list(user: AuthUser, status?: ConsultingStatus) {
    const staff = isStaff(user.role);
    const rows = await this.prisma.consultingRequest.findMany({
      where: {
        status,
        ...(staff ? {} : { userId: user.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: staff
        ? { user: { select: { id: true, fullName: true, email: true, role: true } } }
        : undefined,
    });
    // İç admin notunu bayiye sızdırma
    if (!staff) for (const r of rows) delete (r as Partial<typeof r>).adminNote;
    return rows;
  }

  async get(user: AuthUser, id: string) {
    const staff = isStaff(user.role);
    const req = await this.prisma.consultingRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    if (!staff && req.userId !== user.userId) {
      throw new ForbiddenException('Bu talebe erişiminiz yok');
    }
    if (!staff) delete (req as Partial<typeof req>).adminNote;
    return req;
  }

  async update(user: AuthUser, id: string, dto: UpdateConsultingDto) {
    if (!isStaff(user.role)) throw new ForbiddenException('Yalnız personel güncelleyebilir');
    const current = await this.prisma.consultingRequest.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Talep bulunamadı');
    if (dto.status && dto.status !== current.status) {
      const allowed = CONSULTING_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Geçersiz durum geçişi: ${current.status} → ${dto.status}`,
        );
      }
    }
    const req = await this.prisma.consultingRequest.update({
      where: { id },
      data: {
        status: dto.status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        meetingUrl: dto.meetingUrl,
        adminNote: dto.adminNote,
      },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'CONSULTING_UPDATE',
      entityType: 'ConsultingRequest',
      entityId: id,
      meta: { ...dto },
    });
    return req;
  }
}

@Controller('consulting')
export class ConsultingController {
  constructor(private readonly svc: ConsultingService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConsultingDto) {
    return this.svc.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: ConsultingStatus) {
    return this.svc.list(user, status);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Roles(Role.ADMIN, Role.PRODUCTION)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateConsultingDto,
  ) {
    return this.svc.update(user, id, dto);
  }
}

@Module({
  providers: [ConsultingService],
  controllers: [ConsultingController],
})
export class ConsultingModule {}
