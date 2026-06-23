import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseShiftDto {
  @ApiProperty({ example: 3200 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  closingBalance: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
