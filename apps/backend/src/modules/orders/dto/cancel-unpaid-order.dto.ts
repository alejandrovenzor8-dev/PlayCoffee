import { Equals, IsBoolean, IsString, MinLength } from 'class-validator';

export class CancelUnpaidOrderDto {
  @IsBoolean()
  @Equals(true)
  confirmed!: boolean;

  @IsString()
  @MinLength(3)
  reason!: string;
}
