import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { R2_CLIENT } from '../files/r2.client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class PresignDto {
  @IsString() fileName: string;
  @IsOptional() @IsString() mimeType?: string;
}

class CreateDocumentDto {
  @IsString() fileName: string;
  @IsString() r2Key: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
  @IsOptional() @IsString() category?: string; // ORDER | DEALER | GENERAL
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsString() userId?: string; // ilgili bayi
}

@Injectable()
export class DocumentsService {
  private bucket: string;
  private expires: number;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
    @Inject(R2_CLIENT) private s3: S3Client,
  ) {
    this.bucket = this.config.get<string>('R2_BUCKET') || 'printy-files';
    this.expires = this.config.get<number>('R2_PRESIGN_EXPIRES') ?? 3600;
  }

  private isStaff(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.PRODUCTION;
  }

  // Yükleme için presigned PUT URL
  async presign(user: AuthUser, dto: PresignDto) {
    const safe = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const key = `documents/${user.userId}/${randomUUID()}-${safe}`;
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.mimeType,
      }),
      { expiresIn: this.expires },
    );
    return { uploadUrl: url, r2Key: key, expiresIn: this.expires };
  }

  // Yükleme sonrası kayıt oluştur
  async create(user: AuthUser, dto: CreateDocumentDto) {
    const doc = await this.prisma.document.create({
      data: {
        fileName: dto.fileName,
        r2Key: dto.r2Key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        category: dto.category ?? (dto.orderId ? 'ORDER' : 'GENERAL'),
        orderId: dto.orderId,
        userId: dto.userId ?? user.userId,
        organizationId: user.organizationId ?? undefined,
        uploadedByUserId: user.userId,
      },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'DOCUMENT_UPLOAD',
      entityType: 'Document',
      entityId: doc.id,
      meta: { fileName: doc.fileName, orderId: doc.orderId },
    });
    return doc;
  }

  // Bayi yalnız kendi/firma belgelerini; staff hepsini görür
  list(user: AuthUser, filter: { orderId?: string; userId?: string }) {
    const scope = this.isStaff(user)
      ? {}
      : {
          OR: [
            { uploadedByUserId: user.userId },
            { userId: user.userId },
            ...(user.organizationId
              ? [{ organizationId: user.organizationId }]
              : []),
          ],
        };
    return this.prisma.document.findMany({
      where: { ...scope, orderId: filter.orderId, userId: filter.userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async getOwned(user: AuthUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Belge bulunamadı');
    const owns =
      this.isStaff(user) ||
      doc.uploadedByUserId === user.userId ||
      doc.userId === user.userId ||
      (!!user.organizationId && doc.organizationId === user.organizationId);
    if (!owns) throw new ForbiddenException('Bu belgeye erişiminiz yok');
    return doc;
  }

  async download(user: AuthUser, id: string) {
    const doc = await this.getOwned(user, id);
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: doc.r2Key }),
      { expiresIn: this.expires },
    );
    return { downloadUrl: url, fileName: doc.fileName, expiresIn: this.expires };
  }

  async remove(user: AuthUser, id: string) {
    const doc = await this.getOwned(user, id);
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: doc.r2Key }),
      );
    } catch {
      // R2 silme hatasında bile kaydı düşür (orphan obje lifecycle ile temizlenir)
    }
    await this.prisma.document.delete({ where: { id } });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'DOCUMENT_DELETE',
      entityType: 'Document',
      entityId: id,
    });
    return { deleted: true };
  }
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Post('presign')
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.docs.presign(user, dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.docs.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('orderId') orderId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.docs.list(user, { orderId, userId });
  }

  @Get(':id/download')
  download(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.docs.download(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.docs.remove(user, id);
  }
}

@Module({
  providers: [
    DocumentsService,
    {
      provide: R2_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          region: 'auto',
          endpoint: config.get<string>('R2_ENDPOINT'),
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') as string,
            secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') as string,
          },
        }),
    },
  ],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
