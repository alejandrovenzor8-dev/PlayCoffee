import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateTableDto } from './create-table.dto';

export class LayoutTableDto extends CreateTableDto {
  @IsOptional() @IsString() id?: string;
}

export class SaveLayoutDto {
  @IsString() areaId: string;
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LayoutTableDto)
  tables: LayoutTableDto[];
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) deletedIds: string[];
}
