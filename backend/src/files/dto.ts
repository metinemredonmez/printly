import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetRole } from '@prisma/client';

export class InitiateUploadDto {
  @IsString() originalName: string;
  @IsOptional() @IsString() mime?: string;
  @IsInt() @Min(1) sizeBytes: number;
  @IsOptional() @IsEnum(AssetRole) role?: AssetRole; // PRODUCTION | MOCKUP | SHIPPING_LABEL
  @IsOptional() @IsString() orderId?: string;
}

export class CompletePartDto {
  @IsInt() @Min(1) partNumber: number;
  @IsString() etag: string;
}

export class CompleteUploadDto {
  @IsString() assetId: string;
  @IsString() uploadId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletePartDto)
  parts: CompletePartDto[];
}

export class AbortUploadDto {
  @IsString() assetId: string;
  @IsString() uploadId: string;
}
