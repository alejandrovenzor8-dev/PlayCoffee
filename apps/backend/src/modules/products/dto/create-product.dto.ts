import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiPropertyOptional() @IsString() @IsOptional() categoryId?: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsNumber() @IsPositive() @Type(() => Number) price: number;
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
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isFeatured?: boolean;
}
