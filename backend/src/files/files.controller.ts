import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FilesService } from './files.service';
import {
  InitiateUploadDto,
  CompleteUploadDto,
  AbortUploadDto,
  ValidateSpecDto,
} from './dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  // Baskı dosyası ürün gereksinimlerine uyuyor mu? (yükleme öncesi) — H3/#34
  @Post('validate-spec')
  validateSpec(@Body() dto: ValidateSpecDto) {
    return this.files.validateSpec(dto);
  }

  // 1) Yükleme başlat → presigned URL(ler)
  @Post('initiate')
  initiate(@CurrentUser() user: AuthUser, @Body() dto: InitiateUploadDto) {
    return this.files.initiate(user, dto);
  }

  // 2a) Tek-parça yükleme tamamlandı bildirimi (sahiplik kontrollü)
  @Post(':assetId/mark-ready')
  markReady(@CurrentUser() user: AuthUser, @Param('assetId') assetId: string) {
    return this.files.markReady(user, assetId);
  }

  // 2b) Multipart tamamla
  @Post('complete')
  complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteUploadDto) {
    return this.files.complete(user, dto);
  }

  // İptal
  @Post('abort')
  abort(@CurrentUser() user: AuthUser, @Body() dto: AbortUploadDto) {
    return this.files.abort(user, dto);
  }

  // İndirme linki (presigned GET) — sahiplik veya ADMIN/PRODUCTION
  @Get(':assetId/download-url')
  downloadUrl(@CurrentUser() user: AuthUser, @Param('assetId') assetId: string) {
    return this.files.downloadUrl(user, assetId);
  }
}
