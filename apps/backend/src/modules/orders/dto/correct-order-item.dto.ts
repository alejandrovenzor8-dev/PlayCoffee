import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
export class CorrectOrderItemDto {
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
