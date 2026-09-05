import { IsArray, IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdatePaymentConfigDto {
  @IsBoolean()
  tipEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  defaultTipPercentage!: number;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  tipPercentages!: number[];
}
