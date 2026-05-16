import {
  IsString, IsArray, IsOptional, IsBoolean, IsNumber, IsEnum, Min, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OrderItemModifierDto {
  @ApiProperty() @IsString() modifierId: string;
  @ApiPropertyOptional() @IsNumber() @Min(1) @IsOptional() @Type(() => Number) quantity?: number;
}

export class CreateOrderItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  @IsOptional()
  modifiers?: OrderItemModifierDto[];
}

export class CreateOrderDto {
  @ApiProperty() @IsString() branchId: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tableId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isDelivery?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isTakeaway?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() deliveryAddress?: string;
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
