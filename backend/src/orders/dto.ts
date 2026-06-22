import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory, PaymentMethod, OrderStatus } from '@prisma/client';

export class OrderItemInput {
  @IsString() productId: string;
  @IsNumber() @Min(0) widthInch: number;
  @IsNumber() @Min(0) heightInch: number;
  @IsInt() @Min(1) quantity: number;
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
