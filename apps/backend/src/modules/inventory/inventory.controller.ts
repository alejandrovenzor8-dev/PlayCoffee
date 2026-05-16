import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, InventoryMovementDto } from './dto/create-inventory-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Inventory')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) { return this.inventoryService.findAll(search); }

  @Post()
  create(@Body() dto: CreateInventoryItemDto) { return this.inventoryService.create(dto); }

  @Post('movements')
  recordMovement(@Body() dto: InventoryMovementDto) {
    return this.inventoryService.recordMovement(dto);
  }

  @Get('movements')
  getAllMovements(@Query('limit') limit?: string) {
    return this.inventoryService.getAllMovements(limit ? Number(limit) : 50);
  }

  @Get(':id/movements')
  getMovements(@Param('id') id: string) { return this.inventoryService.getMovements(id); }
}
