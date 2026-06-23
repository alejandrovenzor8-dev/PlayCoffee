import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';

export class CreateUserDto {
  @ApiPropertyOptional() @IsString() @IsOptional() branchId?: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsString() @MinLength(6) password: string;
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/)
  pin?: string;
  @ApiPropertyOptional()
  @IsEnum(UserRoleEnum)
  @IsOptional()
  role?: UserRoleEnum;
  @ApiPropertyOptional() @IsString() @IsOptional() avatarUrl?: string;
}
