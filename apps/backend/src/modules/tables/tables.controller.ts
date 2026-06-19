import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Tables')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'areaId', required: false })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('areaId') areaId?: string,
  ) {
    return this.tablesService.findAll(branchId, areaId);
  }

  @Get('areas')
  @ApiQuery({ name: 'branchId', required: false })
  findAreas(@Query('branchId') branchId?: string) { return this.tablesService.findAreas(branchId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.tablesService.findOne(id); }

  @Post()
  create(@Body() dto: CreateTableDto) { return this.tablesService.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TableStatus,
    @CurrentUser('id') userId: string,
  ) {
    return this.tablesService.updateStatus(id, status, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.tablesService.remove(id); }
}
