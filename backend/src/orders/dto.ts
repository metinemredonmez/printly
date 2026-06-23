import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory, PaymentMethod, OrderStatus } from '@prisma/client';

export class OrderItemInput {
  @IsString() productId: string;
  // Ölçü/adet üst sınırı — astronomik fiyat + Decimal taşması engeli (M4)
  @IsNumber() @Min(0) @Max(2000) widthInch: number;
  @IsNumber() @Min(0) @Max(2000) heightInch: number;
  @IsInt() @Min(1) @Max(100000) quantity: number;
  @IsOptional() @IsString() notes?: string;
}

export class OrderExtraInput {
  @IsString() extraOptionId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
}

export class CreateOrderDto {
  @IsEnum(ProductCategory) category: ProductCategory;
  @IsOptional() @IsString() productType?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderExtraInput)
  extras?: OrderExtraInput[];

  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;

  // Numune sipariş (D2/#41) — sabit düşük ücret, ölçü/fiyat motoru baypas
  @IsOptional() @IsBoolean() isSample?: boolean;

  @IsOptional() @IsString() etsyStoreId?: string;
  @IsOptional() @IsString() etsyOrderNo?: string;
  @IsOptional() @IsDateString() orderDate?: string;

  // Teslimat
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsString() clientAddress?: string;
  @IsOptional() @IsString() clientCountry?: string;
  @IsOptional() @IsString() clientCity?: string;
  @IsOptional() @IsString() clientState?: string;
  @IsOptional() @IsString() clientZip?: string;
  @IsOptional() @IsString() clientPhone?: string;
  @IsOptional() @IsString() clientNote?: string;
}

export class UpdateStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsOptional() @IsString() note?: string;
}
