import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    if (!branchId) throw new BadRequestException('branchId is required');
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
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            deletedAt: null,
          },
          select: { id: true, orderNumber: true, status: true, total: true },
          take: 1,
        },
      },
      orderBy: [{ area: { name: 'asc' } }, { number: 'asc' }],
    });
  }

  async findAreas(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
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

  async findOne(id: string, branchId?: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { area: { branchId } } : {}),
      },
      include: { area: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  private async assertAreaInBranch(areaId: string, branchId?: string) {
    if (!branchId) return;
    const area = await this.prisma.tableArea.findFirst({
      where: { id: areaId, branchId, deletedAt: null },
      select: { id: true },
    });
    if (!area) {
      throw new BadRequestException('Area does not belong to this branch');
    }
  }

  async create(dto: CreateTableDto, branchId?: string) {
    await this.assertAreaInBranch(dto.areaId, branchId);
    return this.prisma.restaurantTable.create({
      data: dto,
      include: { area: true },
    });
  }

  async update(id: string, dto: UpdateTableDto, branchId?: string) {
    await this.findOne(id, branchId);
    if (dto.areaId) {
      await this.assertAreaInBranch(dto.areaId, branchId);
    }
    return this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
      include: { area: true },
    });
  }

  async updateStatus(
    id: string,
    status: TableStatus,
    userId?: string,
    branchId?: string,
  ) {
    const table = await this.findOne(id, branchId);
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

  async remove(id: string, branchId?: string) {
    await this.findOne(id, branchId);
    return this.prisma.restaurantTable.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
