import { IsIn, IsString, MaxLength } from 'class-validator';

export class TestPrinterDto {
  @IsString()
  @MaxLength(500)
  target!: string;

  @IsIn(['58mm', '80mm'])
  width!: '58mm' | '80mm';

  @IsIn(['CUSTOMER', 'KITCHEN', 'BAR'])
  type!: 'CUSTOMER' | 'KITCHEN' | 'BAR';
}
