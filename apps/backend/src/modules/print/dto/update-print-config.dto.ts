import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePrintConfigDto {
  @IsIn(['BUSINESS_ONLY', 'CUSTOMER_AND_BUSINESS'])
  @IsOptional()
  cashierMode?: 'BUSINESS_ONLY' | 'CUSTOMER_AND_BUSINESS';

  @IsBoolean() @IsOptional() confirmClose?: boolean;
  @IsBoolean() @IsOptional() allowReprint?: boolean;

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
