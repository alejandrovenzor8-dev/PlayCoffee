import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto,
  InventoryMovementDto,
} from './dto/create-inventory-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Inventory')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.inventoryService.findAll(search, userBranchId ?? branchId);
  }

  @Post()
  create(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    const branchId = userBranchId ?? dto.branchId;
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.inventoryService.create({
      ...dto,
      branchId,
    });
  }

  @Post('movements')
  recordMovement(
    @Body() dto: InventoryMovementDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.inventoryService.recordMovement(
      dto,
      userBranchId ?? dto.branchId,
    );
  }

  @Get('movements')
  @ApiQuery({ name: 'branchId', required: false })
  getAllMovements(
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.inventoryService.getAllMovements(
      limit ? Number(limit) : 50,
      userBranchId ?? branchId,
    );
  }

  @Get(':id/movements')
  getMovements(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.inventoryService.getMovements(id, userBranchId);
  }
}
