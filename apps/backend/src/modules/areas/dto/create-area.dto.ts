import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({ example: 'Interior', description: 'Nombre del área' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Área principal del restaurante',
    description: 'Descripción del área',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: '#3b82f6',
    description: 'Color hexadecimal para el área',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 0, description: 'Orden de visualización' })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: true, description: 'Si el área está activa' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Datos del plano del área (JSON)' })
  @IsOptional()
  floorPlan?: any;
}
