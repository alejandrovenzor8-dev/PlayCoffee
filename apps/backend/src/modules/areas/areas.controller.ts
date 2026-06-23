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
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto, ReorderAreasDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Areas')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las áreas' })
  @ApiQuery({ name: 'branchId', required: true })
  findAll(
    @Query('branchId') branchId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.findAll(userBranchId ?? branchId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener áreas activas' })
  @ApiQuery({ name: 'branchId', required: true })
  findActive(
    @Query('branchId') branchId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.findActive(userBranchId ?? branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener área por ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.findOne(id, userBranchId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva área' })
  @ApiQuery({ name: 'branchId', required: true })
  create(
    @Query('branchId') branchId: string,
    @Body() dto: CreateAreaDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.create(userBranchId ?? branchId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar área' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.update(id, dto, userBranchId);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Alternar estado activo/inactivo' })
  toggleActive(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.toggleActive(id, userBranchId);
  }

  @Post('reorder')
  @ApiOperation({ summary: 'Reordenar áreas' })
  @ApiQuery({ name: 'branchId', required: true })
  @HttpCode(HttpStatus.OK)
  reorder(
    @Query('branchId') branchId: string,
    @Body() dto: ReorderAreasDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.reorder(userBranchId ?? branchId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar área' })
  remove(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.areasService.remove(id, userBranchId);
  }
}
