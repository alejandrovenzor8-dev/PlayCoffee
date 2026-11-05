import {
  IsString,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsBoolean() @IsOptional() closeConfirmed?: boolean;
  @ApiProperty() @IsString() orderId: string;
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
  @ApiProperty() @IsNumber() @Min(0.01) @Type(() => Number) amount: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  receivedAmount?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  tipAmount?: number;
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  tipPercentage?: number;
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  idempotencyKey?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reference?: string;
}
