import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto, ReorderAreasDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Areas')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las áreas' })
  @ApiQuery({ name: 'branchId', required: true })
  findAll(@Query('branchId') branchId: string) {
    return this.areasService.findAll(branchId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener áreas activas' })
  @ApiQuery({ name: 'branchId', required: true })
  findActive(@Query('branchId') branchId: string) {
    return this.areasService.findActive(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener área por ID' })
  findOne(@Param('id') id: string) {
    return this.areasService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva área' })
  @ApiQuery({ name: 'branchId', required: true })
  create(@Query('branchId') branchId: string, @Body() dto: CreateAreaDto) {
    return this.areasService.create(branchId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar área' })
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Alternar estado activo/inactivo' })
  toggleActive(@Param('id') id: string) {
    return this.areasService.toggleActive(id);
  }

  @Post('reorder')
  @ApiOperation({ summary: 'Reordenar áreas' })
  @ApiQuery({ name: 'branchId', required: true })
  @HttpCode(HttpStatus.OK)
  reorder(@Query('branchId') branchId: string, @Body() dto: ReorderAreasDto) {
    return this.areasService.reorder(branchId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar área' })
  remove(@Param('id') id: string) {
    return this.areasService.remove(id);
  }
}
