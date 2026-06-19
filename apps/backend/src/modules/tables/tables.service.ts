import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TableStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TablesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(branchId?: string, areaId?: string) {
    return this.prisma.restaurantTable.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(areaId ? { areaId } : {}),
        ...(branchId ? { area: { branchId } } : {}),
      },
      include: {
        area: true,
        orders: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, deletedAt: null },
          select: { id: true, orderNumber: true, status: true, total: true },
          take: 1,
        },
      },
      orderBy: [{ area: { name: 'asc' } }, { number: 'asc' }],
    });
  }

  async findAreas(branchId?: string) {
    return this.prisma.tableArea.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        tables: {
          where: { deletedAt: null, isActive: true },
          orderBy: { number: 'asc' },
        },
      },
    });
  }

  async findOne(id: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id, deletedAt: null },
      include: { area: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async create(dto: CreateTableDto) {
    return this.prisma.restaurantTable.create({ data: dto, include: { area: true } });
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.findOne(id);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
      include: { area: true },
    });
  }

  async updateStatus(id: string, status: TableStatus, userId?: string) {
    const table = await this.findOne(id);
    const updatedTable = await this.prisma.restaurantTable.update({
      where: { id },
      data: { status },
      include: { area: true },
    });

    await this.audit.record({
      branchId: updatedTable.area.branchId,
      userId,
      action: 'TABLE_STATUS_CHANGED',
      entity: 'RestaurantTable',
      entityId: updatedTable.id,
      metadata: {
        previousStatus: table.status,
        status: updatedTable.status,
        tableNumber: updatedTable.number,
      },
    });

    return updatedTable;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
