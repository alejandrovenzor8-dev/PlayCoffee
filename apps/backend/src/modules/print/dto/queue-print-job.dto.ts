import { PrintJobType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class QueuePrintJobDto {
  @IsEnum(PrintJobType)
  type!: PrintJobType;
}
