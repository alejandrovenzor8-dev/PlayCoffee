import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ClaimPrintJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  agentId!: string;
}

export class CompletePrintJobDto extends ClaimPrintJobDto {}

export class FailPrintJobDto extends ClaimPrintJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  error!: string;
}
