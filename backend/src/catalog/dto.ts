import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { ProductCategory, ProductUnit } from '@prisma/client';

export class CreateMaterialDto {
  @IsString() name: string;
  @IsOptional() @IsInt() @Min(1) widthInch?: number;
  @IsOptional() settings?: Record<string, unknown>;
}

export class UpdateMaterialDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(1) widthInch?: number;
  @IsOptional() settings?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateProductDto {
  @IsString() name: string;
  @IsEnum(ProductCategory) category: ProductCategory;
  @IsOptional() @IsEnum(ProductUnit) unit?: ProductUnit;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) basePricePerM2?: number; // M2 ürün (1× fiyat)
  @IsOptional() @IsNumber() @Min(0) flatPrice?: number; // FLAT ürün (1× fiyat)
  @IsOptional() subTypes?: unknown; // wallpaper alt türleri
  @IsOptional() @IsString() materialId?: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(ProductCategory) category?: ProductCategory;
  @IsOptional() @IsEnum(ProductUnit) unit?: ProductUnit;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) basePricePerM2?: number;
  @IsOptional() @IsNumber() @Min(0) flatPrice?: number;
  @IsOptional() subTypes?: unknown;
  @IsOptional() @IsString() materialId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateExtraOptionDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() fixedWidthInch?: number;
  @IsOptional() @IsNumber() fixedHeightInch?: number;
}
