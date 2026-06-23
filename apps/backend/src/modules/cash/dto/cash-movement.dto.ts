import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CashMovementDto {
  @ApiProperty({ enum: CashMovementType })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  @ApiProperty({ example: 250 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'Compra de insumos' })
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shiftId?: string;
}
