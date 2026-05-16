import { PartialType } from '@nestjs/swagger';
import { CreateTableDto } from './create-table.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTableDto extends PartialType(CreateTableDto) {
  @IsBoolean() @IsOptional() isActive?: boolean;
}
