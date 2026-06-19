import { IsString, IsNumber, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChildAccessType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateChildAccessDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiProperty() @IsString() childName: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @Max(17) @IsOptional() @Type(() => Number) childAge?: number;
  @ApiProperty() @IsString() guardianName: string;
  @ApiProperty() @IsString() guardianPhone: string;
  @ApiPropertyOptional() @IsNumber() @Min(30) @IsOptional() @Type(() => Number) maxDuration?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() braceletId?: string;
  @ApiPropertyOptional() @IsEnum(ChildAccessType) @IsOptional() type?: ChildAccessType;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
