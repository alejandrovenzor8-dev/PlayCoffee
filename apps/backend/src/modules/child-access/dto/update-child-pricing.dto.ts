import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateChildPricingDto {
  @ApiProperty({ example: 99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  hourlyRate: number;

  @ApiProperty({ example: 49 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  extraHalfHourRate: number;
}
