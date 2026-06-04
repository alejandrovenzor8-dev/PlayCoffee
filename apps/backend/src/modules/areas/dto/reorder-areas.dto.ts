import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, IsString } from 'class-validator';

export class ReorderAreasDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    description: 'Array de IDs de áreas en el nuevo orden',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  areaIds: string[];
}
