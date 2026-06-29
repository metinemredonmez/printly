import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AssetStatus, AssetRole, Role, Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2_CLIENT } from './r2.client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  InitiateUploadDto,
  CompleteUploadDto,
  AbortUploadDto,
  CompletePartDto,
} from './dto';
import { mimeMatchesExt } from '../common/file-validation.util';

const PART_SIZE = 10 * 1024 * 1024; // 10 MB
const MULTIPART_THRESHOLD = 15 * 1024 * 1024; // bunun üstü multipart
const MAX_PARTS = 1000;
const MAX_SIZE = 600 * 1024 * 1024; // 600 MB üst sınır

// Role'e göre izin verilen dosya uzantıları (MIME tarayıcıda tutarsız olduğu için uzantı bazlı)
const ALLOWED_EXT: Record<string, string[]> = {
  PRODUCTION: ['pdf', 'ai', 'eps', 'png', 'tif', 'tiff'],
  MOCKUP: ['jpg', 'jpeg', 'png'],
  SHIPPING_LABEL: ['pdf', 'jpg', 'jpeg', 'png'],
  OTHER: ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff'],
};

@Injectable()
export class FilesService {
  private bucket: string;
  private expiresIn: number;

  constructor(
    @Inject(R2_CLIENT) private s3: S3Client,
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('R2_BUCKET') as string;
    this.expiresIn = config.get<number>('R2_PRESIGN_EXPIRES') ?? 3600;
  }

  /**
   * Yükleme başlatır. Küçük dosya → tek presigned PUT, büyük → multipart.
   * Boyut + uzantı doğrulanır; orderId verilmişse sipariş sahipliği kontrol edilir.
   */
  // Baskı dosyası ürün gereksinimlerine (minDpi / requiredFormats) uyuyor mu? (H3/#34)
  async validateSpec(dto: {
    productId: string;
    format?: string;
    dpi?: number;
    widthPx?: number;
    heightPx?: number;
  }) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { minDpi: true, requiredFormats: true, name: true },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    const issues: string[] = [];
    if (product.requiredFormats?.length && dto.format) {
      const ok = product.requiredFormats
        .map((f) => f.toLowerCase())
        .includes(dto.format.toLowerCase());
      if (!ok) {
        issues.push(
          `Format ".${dto.format}" izinli değil (izinli: ${product.requiredFormats.join(', ')})`,
        );
      }
    }
    if (product.minDpi != null && dto.dpi != null && dto.dpi < product.minDpi) {
      issues.push(`Çözünürlük ${dto.dpi} DPI yetersiz (min ${product.minDpi} DPI)`);
    }
    return {
      valid: issues.length === 0,
      issues,
      requirements: {
        minDpi: product.minDpi,
        requiredFormats: product.requiredFormats,
      },
    };
  }

  async initiate(user: AuthUser, dto: InitiateUploadDto) {
    const role = dto.role ?? AssetRole.OTHER;

    // Boyut sınırı
    if (dto.sizeBytes > MAX_SIZE) {
      throw new BadRequestException(
        `Dosya çok büyük (max ${Math.round(MAX_SIZE / 1024 / 1024)} MB)`,
      );
    }
    // Uzantı whitelist
    const ext = (dto.originalName.split('.').pop() || '').toLowerCase();
    const allowed = ALLOWED_EXT[role] ?? ALLOWED_EXT.OTHER;
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `İzin verilmeyen dosya türü ".${ext}". ${role} için: ${allowed.join(', ')}`,
      );
    }
    // Beyan edilen MIME uzantıyla tutarlı olmalı (sahte uzantı/MIME karışımı engeli — #31)
    if (!mimeMatchesExt(ext, dto.mime)) {
      throw new BadRequestException(
        `Beyan edilen tür (${dto.mime}) uzantı ".${ext}" ile uyuşmuyor`,
      );
    }
    // orderId verildiyse sahiplik
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: { userId: true },
      });
      if (!order) throw new NotFoundException('Sipariş bulunamadı');
      if (!this.canAccess(user, order.userId)) {
        throw new ForbiddenException('Bu siparişe dosya ekleyemezsiniz');
      }
    }

    const safeName = dto.originalName.replace(/[^\w.\-]+/g, '_').slice(-120);
    const key = `org/${user.organizationId ?? 'platform'}/${randomUUID()}-${safeName}`;

    const asset = await this.prisma.asset.create({
      data: {
        r2Key: key,
        originalName: dto.originalName,
        mime: dto.mime,
        sizeBytes: BigInt(dto.sizeBytes),
        status: AssetStatus.UPLOADING,
        role,
        orderId: dto.orderId,
        userId: user.userId,
      },
    });

    if (dto.sizeBytes <= MULTIPART_THRESHOLD) {
      const url = await getSignedUrl(
        this.s3,
        new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: dto.mime }),
        { expiresIn: this.expiresIn },
      );
      return { mode: 'single' as const, assetId: asset.id, key, url };
    }

    const created = await this.s3.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: dto.mime }),
    );
    const uploadId = created.UploadId as string;

    const partCount = Math.min(Math.ceil(dto.sizeBytes / PART_SIZE), MAX_PARTS);
    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_, i) => {
        const partNumber = i + 1;
        const url = await getSignedUrl(
          this.s3,
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: this.expiresIn },
        );
        return { partNumber, url };
      }),
    );

    await this.prisma.asset.update({ where: { id: asset.id }, data: { uploadId } });

    return {
      mode: 'multipart' as const,
      assetId: asset.id,
      key,
      uploadId,
      partSize: PART_SIZE,
      parts,
    };
  }

  async markReady(user: AuthUser, assetId: string) {
    const asset = await this.getOwnedAsset(user, assetId);

    // Spec kontrolü (format/DPI) — üretim dosyası siparişe bağlıysa otomatik doğrula.
    // Engelleyici değil: sonuç asset.checks'e yazılır, UI uyarı gösterebilir (H3 bağlandı).
    let checks: Prisma.InputJsonValue | undefined;
    if (asset.role === AssetRole.PRODUCTION && asset.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: asset.orderId },
        select: {
          items: {
            select: { product: { select: { minDpi: true, requiredFormats: true } } },
          },
        },
      });
      const ext = (asset.originalName.split('.').pop() || '').toLowerCase();
      const issues: string[] = [];
      for (const it of order?.items ?? []) {
        const p = it.product;
        if (!p) continue;
        if (
          p.requiredFormats?.length &&
          ext &&
          !p.requiredFormats.map((f) => f.toLowerCase()).includes(ext)
        ) {
          issues.push(
            `Format ".${ext}" izinli değil (izinli: ${p.requiredFormats.join(', ')})`,
          );
        }
        if (p.minDpi != null && asset.dpi != null && asset.dpi < p.minDpi) {
          issues.push(`Çözünürlük ${asset.dpi} DPI yetersiz (min ${p.minDpi} DPI)`);
        }
      }
      const unique = [...new Set(issues)];
      checks = { spec: { valid: unique.length === 0, issues: unique } };
    }

    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.READY,
        ...(checks !== undefined ? { checks } : {}),
      },
    });
  }

  async complete(user: AuthUser, dto: CompleteUploadDto) {
    const asset = await this.getOwnedAsset(user, dto.assetId);
    const parts = [...dto.parts].sort((a, b) => a.partNumber - b.partNumber);
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: asset.r2Key,
        UploadId: dto.uploadId,
        MultipartUpload: {
          Parts: parts.map((p: CompletePartDto) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      }),
    );
    return this.prisma.asset.update({
      where: { id: dto.assetId },
      data: { status: AssetStatus.READY },
    });
  }

  async abort(user: AuthUser, dto: AbortUploadDto) {
    const asset = await this.getOwnedAsset(user, dto.assetId);
    await this.s3.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: asset.r2Key,
        UploadId: dto.uploadId,
      }),
    );
    return this.prisma.asset.update({
      where: { id: dto.assetId },
      data: { status: AssetStatus.FAILED },
    });
  }

  // İndirme: sahip VEYA ADMIN/PRODUCTION (üretim ekibi baskı için indirir).
  async downloadUrl(user: AuthUser, assetId: string) {
    const asset = await this.getOwnedAsset(user, assetId);
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: asset.r2Key }),
      { expiresIn: this.expiresIn },
    );
    return { url, originalName: asset.originalName };
  }

  // ── yetki ────────────────────────────────────
  private canAccess(user: AuthUser, ownerId: string | null): boolean {
    if (user.role === Role.ADMIN || user.role === Role.PRODUCTION) return true;
    return !!ownerId && ownerId === user.userId;
  }

  private async getOwnedAsset(user: AuthUser, id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Dosya kaydı bulunamadı');
    if (!this.canAccess(user, asset.userId)) {
      throw new ForbiddenException('Bu dosyaya erişiminiz yok');
    }
    return asset;
  }
}
