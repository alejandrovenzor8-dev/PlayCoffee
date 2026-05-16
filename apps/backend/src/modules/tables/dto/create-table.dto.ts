import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTableDto {
  @ApiProperty() @IsString() areaId: string;
  @ApiProperty() @IsString() number: string;
  @ApiPropertyOptional() @IsNumber() @Min(1) @IsOptional() @Type(() => Number) capacity?: number;
  @ApiPropertyOptional() @IsEnum(TableStatus) @IsOptional() status?: TableStatus;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Type(() => Number) posX?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Type(() => Number) posY?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() shape?: string;
}
