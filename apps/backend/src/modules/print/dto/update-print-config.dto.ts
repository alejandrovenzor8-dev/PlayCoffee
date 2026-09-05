import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class UpdatePrintConfigDto {
  @IsString()
  @MaxLength(500)
  cashierPrinter!: string;

  @IsString()
  @MaxLength(500)
  kitchenPrinter!: string;

  @IsString()
  @MaxLength(500)
  barPrinter!: string;

  @IsIn(['58mm', '80mm'])
  width!: '58mm' | '80mm';

  @IsBoolean()
  autoKitchen!: boolean;

  @IsBoolean()
  autoBar!: boolean;

  @IsBoolean()
  autoCustomer!: boolean;
}
