import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import { Prisma, Role, CourseCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

// Ekip Üyesi (TEAM_MEMBER/TEAM_LEADER) → tüm eğitimlerde %50 (PDF)
const MEMBER_RATE = 0.5;
function isMember(role: Role) {
  return role === Role.TEAM_MEMBER || role === Role.TEAM_LEADER;
}

class UpsertCourseDto {
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() titleEn?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(CourseCategory) category?: CourseCategory;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) durationMin?: number;
  @IsOptional() @IsInt() @Min(0) lessonCount?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() contentUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

@Injectable()
export class EducationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Bayiye dönen fiyat bilgisi (standart + üye)
  private withPricing(c: any, role: Role) {
    const price = Number(c.price);
    const member = isMember(role);
    return {
      ...c,
      price,
      memberPrice: Number((price * MEMBER_RATE).toFixed(2)),
      yourPrice: Number((price * (member ? MEMBER_RATE : 1)).toFixed(2)),
      isMember: member,
    };
  }

  async list(user: AuthUser, category?: CourseCategory) {
    const rows = await this.prisma.course.findMany({
      where: { active: true, category },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    const enrolled = new Set(
      (
        await this.prisma.courseEnrollment.findMany({
          where: { userId: user.userId },
          select: { courseId: true },
        })
      ).map((e) => e.courseId),
    );
    return rows.map((c) => ({
      ...this.withPricing(c, user.role),
      enrolled: enrolled.has(c.id),
      contentUrl: enrolled.has(c.id) ? c.contentUrl : null, // içerik linki sadece kayıtlıya
    }));
  }

  async get(user: AuthUser, id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!c || !c.active) throw new NotFoundException('Eğitim bulunamadı');
    const enrolled = !!(await this.prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: id, userId: user.userId } },
    }));
    return {
      ...this.withPricing(c, user.role),
      enrolled,
      contentUrl: enrolled ? c.contentUrl : null,
    };
  }

  async myEnrollments(user: AuthUser) {
    return this.prisma.courseEnrollment.findMany({
      where: { userId: user.userId },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Kayıt — ücretliyse cüzdandan atomik düşülür (üye %50)
  async enroll(user: AuthUser, courseId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({ where: { id: courseId } });
      if (!course || !course.active)
        throw new NotFoundException('Eğitim bulunamadı');

      const existing = await tx.courseEnrollment.findUnique({
        where: { courseId_userId: { courseId, userId: user.userId } },
      });
      if (existing) throw new BadRequestException('Bu eğitime zaten kayıtlısınız');

      const member = isMember(user.role);
      const price = Number((Number(course.price) * (member ? MEMBER_RATE : 1)).toFixed(2));

      if (price > 0) {
        const u = await tx.user.findUnique({
          where: { id: user.userId },
          select: { balance: true },
        });
        const bal = Number(u?.balance ?? 0);
        if (bal < price)
          throw new BadRequestException(
            `Yetersiz bakiye. Gerekli: $${price.toFixed(2)}, mevcut: $${bal.toFixed(2)}`,
          );
        const next = Number((bal - price).toFixed(2));
        await tx.user.update({
          where: { id: user.userId },
          data: { balance: new Prisma.Decimal(next) },
        });
        await tx.creditLedger.create({
          data: {
            userId: user.userId,
            delta: new Prisma.Decimal(-price),
            balanceAfter: new Prisma.Decimal(next),
            reason: `Eğitim kaydı: ${course.title}`,
          },
        });
      }

      return tx.courseEnrollment.create({
        data: {
          courseId,
          userId: user.userId,
          paidPrice: new Prisma.Decimal(price),
          isMember: member,
        },
        include: { course: true },
      });
    });

    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'COURSE_ENROLL',
      entityType: 'Course',
      entityId: courseId,
      meta: { paidPrice: Number(result.paidPrice) },
    });
    return result;
  }

  // ── Admin ──
  adminList() {
    return this.prisma.course.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async create(actor: AuthUser, dto: UpsertCourseDto) {
    const c = await this.prisma.course.create({
      data: {
        title: dto.title,
        titleEn: dto.titleEn,
        summary: dto.summary,
        description: dto.description,
        category: dto.category ?? CourseCategory.OTHER,
        level: dto.level,
        price: new Prisma.Decimal(dto.price ?? 0),
        durationMin: dto.durationMin,
        lessonCount: dto.lessonCount,
        imageUrl: dto.imageUrl,
        contentUrl: dto.contentUrl,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'COURSE_CREATE',
      entityType: 'Course',
      entityId: c.id,
      meta: { title: c.title },
    });
    return c;
  }

  async update(actor: AuthUser, id: string, dto: UpsertCourseDto) {
    const data: Prisma.CourseUpdateInput = { ...dto } as any;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    const c = await this.prisma.course.update({ where: { id }, data });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'COURSE_UPDATE',
      entityType: 'Course',
      entityId: id,
      meta: { ...dto },
    });
    return c;
  }

  async remove(actor: AuthUser, id: string) {
    // Kayıt varsa silme yerine pasifleştir (veri kaybı olmasın)
    const count = await this.prisma.courseEnrollment.count({ where: { courseId: id } });
    if (count > 0) {
      return this.prisma.course.update({ where: { id }, data: { active: false } });
    }
    await this.prisma.course.delete({ where: { id } });
    await this.audit.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'COURSE_DELETE',
      entityType: 'Course',
      entityId: id,
    });
    return { deleted: true };
  }
}

@Controller('courses')
export class EducationController {
  constructor(private readonly svc: EducationService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('category') category?: CourseCategory) {
    return this.svc.list(user, category);
  }

  @Get('me/enrollments')
  mine(@CurrentUser() user: AuthUser) {
    return this.svc.myEnrollments(user);
  }

  @Roles(Role.ADMIN)
  @Get('admin/all')
  adminList() {
    return this.svc.adminList();
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Post(':id/enroll')
  enroll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.enroll(user, id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertCourseDto) {
    return this.svc.create(user, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertCourseDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.remove(user, id);
  }
}

@Module({
  providers: [EducationService],
  controllers: [EducationController],
})
export class EducationModule {}
