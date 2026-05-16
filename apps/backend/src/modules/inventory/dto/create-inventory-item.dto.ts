import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @ApiPropertyOptional() @IsString() @IsOptional() productId?: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) currentStock: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) minStock?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) maxStock?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) costPerUnit?: number;
}

export class InventoryMovementDto {
  @ApiProperty() @IsString() inventoryItemId: string;
  @ApiProperty({ enum: MovementType }) @IsEnum(MovementType) type: MovementType;
  @ApiProperty() @IsNumber() @Min(0.001) @Type(() => Number) quantity: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reference?: string;
}
