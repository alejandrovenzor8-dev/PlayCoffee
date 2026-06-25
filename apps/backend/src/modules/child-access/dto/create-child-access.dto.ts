import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChildAccessMode, ChildAccessType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateChildAccessDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() orderId?: string;
  @ApiProperty() @IsString() childName: string;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(17)
  @IsOptional()
  @Type(() => Number)
  childAge?: number;
  @ApiProperty() @IsString() guardianName: string;
  @ApiPropertyOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{7,20}$/)
  @IsOptional()
  guardianPhone?: string;
  @ApiPropertyOptional({ enum: ChildAccessMode })
  @IsEnum(ChildAccessMode)
  @IsOptional()
  accessMode?: ChildAccessMode;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(30)
  @IsOptional()
  @Type(() => Number)
  maxDuration?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  contractedMinutes?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  hourlyRate?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  freePrice?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() braceletId?: string;
  @ApiPropertyOptional()
  @IsEnum(ChildAccessType)
  @IsOptional()
  type?: ChildAccessType;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class CheckoutChildAccessDto {
  @ApiPropertyOptional() @IsString() @IsOptional() accessCode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guardianName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guardianPhone?: string;
}
