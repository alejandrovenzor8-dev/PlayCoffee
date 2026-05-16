import {
  IsString, IsNumber, IsOptional, IsEmail, IsDateString, IsEnum, Min, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty() @IsString() branchId: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tableId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() packageId?: string;
  @ApiProperty() @IsString() contactName: string;
  @ApiProperty() @IsString() contactPhone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() contactEmail?: string;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) partySize: number;
  @ApiProperty() @IsDateString() reservedAt: string;
  @ApiPropertyOptional() @IsNumber() @Min(30) @IsOptional() @Type(() => Number) duration?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() occasion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) deposit?: number;
}
