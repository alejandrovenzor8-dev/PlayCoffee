import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenShiftDto {
  @ApiPropertyOptional({ example: 1500 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  openingBalance: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
