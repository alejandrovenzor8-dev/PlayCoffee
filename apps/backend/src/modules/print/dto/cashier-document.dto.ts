import { IsString, IsUUID, MinLength } from 'class-validator';
export class QueuePrebillDto {
  @IsUUID() requestId!: string;
}
export class BusinessReceiptPrintDto extends QueuePrebillDto {
  @IsString() @MinLength(3) reason!: string;
}
