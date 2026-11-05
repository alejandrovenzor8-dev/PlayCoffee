import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { SaveLayoutDto } from './dto/save-layout.dto';
import { TableStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TablesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private realtime: RealtimeGateway,
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
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            user: { select: { id: true, firstName: true, lastName: true } },
            items: {
              where: { status: { not: 'CANCELLED' } },
              select: {
                id: true,
                quantity: true,
                totalPrice: true,
                status: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ area: { name: 'asc' } }, { number: 'asc' }],
    });
  }

  async findAreas(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.tableArea.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { order: 'asc' },
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
    const table = await this.prisma.restaurantTable.create({
      data: dto,
      include: { area: true },
    });
    this.realtime.emitTableUpdated(table.area.branchId, {
      id: table.id,
      status: table.status,
    });
    return table;
  }

  async saveLayout(dto: SaveLayoutDto, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const result = await this.prisma.$transaction(
      async (tx) => {
        const area = await tx.tableArea.findFirst({
          where: { id: dto.areaId, branchId, deletedAt: null, isActive: true },
        });
        if (!area)
          throw new BadRequestException(
            'El area no pertenece a esta sucursal o esta inactiva.',
          );
        const ids = dto.tables.flatMap((table) => (table.id ? [table.id] : []));
        const allIds = [...ids, ...dto.deletedIds];
        if (
          new Set(allIds).size !== allIds.length ||
          dto.tables.some((table) => table.areaId !== dto.areaId)
        ) {
          throw new BadRequestException(
            'El plano contiene mesas repetidas o de otra area.',
          );
        }
        const existing = await tx.restaurantTable.findMany({
          where: { areaId: dto.areaId, deletedAt: null, isActive: true },
          include: {
            orders: {
              where: {
                deletedAt: null,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
              select: { id: true },
            },
          },
        });
        if (allIds.some((id) => !existing.some((table) => table.id === id))) {
          throw new BadRequestException(
            'Una mesa ya no existe en esta area. Recarga el plano.',
          );
        }
        for (const id of dto.deletedIds) {
          const table = existing.find((entry) => entry.id === id)!;
          if (table.orders.length || table.status === 'OCCUPIED') {
            throw new BadRequestException(
              `No se puede eliminar la mesa ${table.number}: tiene una cuenta abierta o esta ocupada.`,
            );
          }
        }
        const numbers = dto.tables.map((table) => table.number.trim());
        const untouched = existing.filter(
          (table) => !allIds.includes(table.id),
        );
        const allNumbers = [
          ...numbers,
          ...untouched.map((table) => table.number.trim()),
        ];
        if (
          allNumbers.some((number) => !number) ||
          new Set(allNumbers).size !== allNumbers.length
        ) {
          throw new BadRequestException(
            'Cada mesa debe tener un numero o nombre unico dentro del area.',
          );
        }
        for (const table of dto.tables) {
          const { id, status: _status, ...data } = table;
          // The operational status can change on another device while the layout is edited.
          if (id)
            await tx.restaurantTable.update({
              where: { id },
              data: { ...data, number: data.number.trim() },
            });
          else
            await tx.restaurantTable.create({
              data: {
                ...data,
                number: data.number.trim(),
                status: 'AVAILABLE',
              },
            });
        }
        if (dto.deletedIds.length)
          await tx.restaurantTable.updateMany({
            where: { id: { in: dto.deletedIds } },
            data: { deletedAt: new Date() },
          });
        return tx.restaurantTable.findMany({
          where: { areaId: dto.areaId, deletedAt: null, isActive: true },
          include: { area: true },
          orderBy: { number: 'asc' },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    this.realtime.emitToBranch(branchId, 'table.layout.updated', {
      areaId: dto.areaId,
    });
    return result;
  }

  async update(id: string, dto: UpdateTableDto, branchId?: string) {
    await this.findOne(id, branchId);
    if (dto.areaId) {
      await this.assertAreaInBranch(dto.areaId, branchId);
    }
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
      include: { area: true },
    });
    this.realtime.emitTableUpdated(table.area.branchId, {
      id: table.id,
      status: table.status,
    });
    if (
      dto.posX !== undefined ||
      dto.posY !== undefined ||
      dto.width !== undefined ||
      dto.height !== undefined ||
      dto.rotation !== undefined
    ) {
      this.realtime.emitToBranch(table.area.branchId, 'table.layout.updated', {
        id: table.id,
      });
    }
    return table;
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

    this.realtime.emitTableStatusChanged(updatedTable.area.branchId, {
      id: updatedTable.id,
      status: updatedTable.status,
    });

    return updatedTable;
  }

  async remove(id: string, branchId?: string) {
    const current = await this.findOne(id, branchId);
    const openOrders = await this.prisma.order.count({
      where: {
        tableId: id,
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });
    if (current.status === 'OCCUPIED' || openOrders > 0) {
      throw new BadRequestException(
        'No se puede eliminar una mesa ocupada o con una cuenta abierta.',
      );
    }
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { area: true },
    });
    this.realtime.emitTableUpdated(table.area.branchId, {
      id: table.id,
      status: table.status,
    });
    return table;
  }
}
