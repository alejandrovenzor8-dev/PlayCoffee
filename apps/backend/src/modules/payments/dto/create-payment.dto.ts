import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty() @IsString() orderId: string;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) amount: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) tipAmount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() reference?: string;
}
