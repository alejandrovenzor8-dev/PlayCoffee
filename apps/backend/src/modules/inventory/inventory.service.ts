import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInventoryItemDto,
  InventoryMovementDto,
} from './dto/create-inventory-item.dto';
import { MovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { product: { include: { category: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findLowStock(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        currentStock: number;
        minStock: number;
      }>
    >`
      SELECT id, name, "currentStock", "minStock"
      FROM "inventory_items"
      WHERE "deletedAt" IS NULL
        AND "isActive" = true
        AND "branchId" = ${branchId}
        AND "currentStock" <= "minStock"
      ORDER BY name ASC
    `;
  }

  async create(dto: CreateInventoryItemDto & { branchId: string }) {
    return this.prisma.inventoryItem.create({ data: dto });
  }

  async recordMovement(dto: InventoryMovementDto, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventoryItemId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });

    if (!item) throw new NotFoundException('Inventory item not found');

    const currentStock = Number(item.currentStock);
    let newStock: number;

    switch (dto.type) {
      case MovementType.IN:
        newStock = currentStock + dto.quantity;
        break;
      case MovementType.OUT:
      case MovementType.WASTE:
        if (currentStock < dto.quantity) {
          throw new BadRequestException('Insufficient stock');
        }
        newStock = currentStock - dto.quantity;
        break;
      case MovementType.ADJUSTMENT:
      case MovementType.TRANSFER:
        newStock = dto.quantity;
        break;
      default:
        newStock = currentStock;
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.create({
        data: {
          ...dto,
          previousStock: currentStock,
          newStock,
        },
      }),
      this.prisma.inventoryItem.update({
        where: { id: dto.inventoryItemId },
        data: { currentStock: newStock },
      }),
    ]);

    return movement;
  }

  async getAllMovements(limit = 50, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.inventoryMovement.findMany({
      where: {
        ...(branchId ? { inventoryItem: { branchId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { inventoryItem: { select: { name: true } } },
    });
  }

  async getMovements(inventoryItemId: string, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.inventoryMovement.findMany({
      where: {
        inventoryItemId,
        ...(branchId ? { inventoryItem: { branchId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
