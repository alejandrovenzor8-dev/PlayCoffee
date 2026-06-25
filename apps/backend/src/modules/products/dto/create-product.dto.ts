import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PreparationStation } from '@prisma/client';

export class CreateProductDto {
  @ApiPropertyOptional() @IsString() @IsOptional() categoryId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) price: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cost?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() sku?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  taxRate?: number;
  @ApiPropertyOptional({ enum: PreparationStation })
  @IsEnum(PreparationStation)
  @IsOptional()
  preparationStation?: PreparationStation;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() trackInventory?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isFeatured?: boolean;
}
