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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableStatus, UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tables')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'areaId', required: false })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('areaId') areaId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.findAll(userBranchId ?? branchId, areaId);
  }

  @Get('areas')
  @ApiQuery({ name: 'branchId', required: false })
  findAreas(
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.findAreas(userBranchId ?? branchId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.findOne(id, userBranchId);
  }

  @Post()
  @Roles(UserRoleEnum.CASHIER)
  create(
    @Body() dto: CreateTableDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.create(dto, userBranchId);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.CASHIER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.update(id, dto, userBranchId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TableStatus,
    @CurrentUser('id') userId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.updateStatus(id, status, userId, userBranchId);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.CASHIER)
  remove(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.tablesService.remove(id, userBranchId);
  }
}
