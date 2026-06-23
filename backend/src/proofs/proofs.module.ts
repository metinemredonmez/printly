import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { Role, ProofStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { NotificationCenterModule, NotificationCenterService } from '../notification-center/notification-center.module';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class CreateProofDto {
  @IsString() orderId: string;
  @IsString() @MinLength(1) fileName: string;
  @IsOptional() @IsString() r2Key?: string;
  @IsOptional() @IsString() note?: string;
}

class RespondDto {
  @IsOptional() @IsString() note?: string;
}

class ArtworkRevisionDto {
  @IsString() @MinLength(1) fileName: string;
  @IsOptional() @IsString() r2Key?: string;
  @IsOptional() @IsString() note?: string;
}

@Injectable()
export class ProofsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notify: NotificationCenterService,
  ) {}

  private isStaff(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.PRODUCTION;
  }

  private async order(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Sipariş bulunamadı');
    return o;
  }

  // Personel proof yükler → bayiye in-app bildirim (#35)
  async create(user: AuthUser, dto: CreateProofDto) {
    if (!this.isStaff(user)) throw new ForbiddenException('Yalnız personel proof yükler');
    const order = await this.order(dto.orderId);
    const proof = await this.prisma.proof.create({
      data: {
        orderId: dto.orderId,
        fileName: dto.fileName,
        r2Key: dto.r2Key,
        note: dto.note,
        createdByUserId: user.userId,
      },
    });
    await this.notify.notify(
      order.userId,
      'PROOF',
      'Onayınız bekleniyor',
      `${order.orderNumber} siparişi için dijital proof yüklendi`,
      { orderId: order.id, proofId: proof.id },
    );
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'PROOF_CREATE',
      entityType: 'Proof',
      entityId: proof.id,
      meta: { orderId: dto.orderId },
    });
    return proof;
  }

  async list(user: AuthUser, orderId: string) {
    const order = await this.order(orderId);
    if (!this.isStaff(user) && order.userId !== user.userId) {
      throw new ForbiddenException('Bu siparişe erişiminiz yok');
    }
    return this.prisma.proof.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Bayi proof'u onaylar/reddeder (#35)
  async respond(user: AuthUser, id: string, approve: boolean, note?: string) {
    const proof = await this.prisma.proof.findUnique({ where: { id } });
    if (!proof) throw new NotFoundException('Proof bulunamadı');
    const order = await this.order(proof.orderId);
    // Sahibi bayi veya admin yanıtlar
    if (order.userId !== user.userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Bu proof’u yanıtlayamazsınız');
    }
    if (proof.status !== ProofStatus.PENDING) {
      throw new BadRequestException('Proof zaten yanıtlanmış');
    }
    const updated = await this.prisma.proof.update({
      where: { id },
      data: {
        status: approve ? ProofStatus.APPROVED : ProofStatus.REJECTED,
        respondedByUserId: user.userId,
        respondedAt: new Date(),
        responseNote: note,
      },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: approve ? 'PROOF_APPROVE' : 'PROOF_REJECT',
      entityType: 'Proof',
      entityId: id,
      meta: { orderId: proof.orderId, note },
    });
    return updated;
  }

  // Proof reddinde / revize gerektiğinde yeni artwork bağla (O4/#36)
  async addRevision(user: AuthUser, orderId: string, dto: ArtworkRevisionDto) {
    const order = await this.order(orderId);
    if (!this.isStaff(user) && order.userId !== user.userId) {
      throw new ForbiddenException('Bu siparişe erişiminiz yok');
    }
    const doc = await this.prisma.document.create({
      data: {
        fileName: dto.fileName,
        r2Key: dto.r2Key ?? `pending/${orderId}/${dto.fileName}`,
        category: 'ARTWORK_REVISION',
        orderId,
        userId: order.userId,
        organizationId: order.organizationId ?? undefined,
        uploadedByUserId: user.userId,
      },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'ARTWORK_REVISION',
      entityType: 'Order',
      entityId: orderId,
      meta: { documentId: doc.id, note: dto.note },
    });
    return { revision: doc };
  }
}

@Controller()
export class ProofsController {
  constructor(private readonly proofs: ProofsService) {}

  @Post('proofs')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProofDto) {
    return this.proofs.create(user, dto);
  }

  @Get('proofs')
  list(@CurrentUser() user: AuthUser, @Query('orderId') orderId: string) {
    return this.proofs.list(user, orderId);
  }

  @Post('proofs/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespondDto) {
    return this.proofs.respond(user, id, true, dto.note);
  }

  @Post('proofs/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespondDto) {
    return this.proofs.respond(user, id, false, dto.note);
  }

  // Artwork revizyon (O4/#36)
  @Post('orders/:orderId/artwork-revision')
  revision(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: ArtworkRevisionDto,
  ) {
    return this.proofs.addRevision(user, orderId, dto);
  }
}

@Module({
  imports: [NotificationCenterModule],
  providers: [ProofsService],
  controllers: [ProofsController],
})
export class ProofsModule {}
