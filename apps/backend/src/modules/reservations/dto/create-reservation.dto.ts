import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() areaId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tableId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() packageId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() orderId?: string;
  @ApiProperty() @IsString() contactName: string;
  @ApiProperty() @IsString() contactPhone: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() contactEmail?: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) partySize: number;
  @ApiProperty() @IsDateString() reservedAt: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endTime?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(30)
  @IsOptional()
  @Type(() => Number)
  duration?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() occasion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  deposit?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  depositAmount?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  totalAmount?: number;
}

export class UpdateReservationDto {
  @ApiPropertyOptional() @IsString() @IsOptional() areaId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tableId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() packageId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() orderId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() contactName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() contactPhone?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() contactEmail?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  partySize?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() reservedAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endTime?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(30)
  @IsOptional()
  @Type(() => Number)
  duration?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() occasion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  depositAmount?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  totalAmount?: number;
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() depositPaid?: boolean;
}

export class CreatePartyPackageDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) price: number;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) maxGuests: number;
  @ApiProperty() @IsNumber() @Min(30) @Type(() => Number) duration: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minDeposit?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}

export class UpdatePartyPackageDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxGuests?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(30)
  @IsOptional()
  @Type(() => Number)
  duration?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minDeposit?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isActive?: boolean;
}
