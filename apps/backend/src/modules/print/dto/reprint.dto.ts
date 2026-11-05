import { IsString, MinLength } from 'class-validator';
export class ReprintDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
