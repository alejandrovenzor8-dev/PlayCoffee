import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInventoryItemDto,
  InventoryMovementDto,
  UpdateInventoryItemDto,
} from './dto/create-inventory-item.dto';
import { MovementType, OrderStatus, Prisma } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

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
    if (!dto.branchId) throw new BadRequestException('branchId is required');
    if (dto.productId) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: {
          branchId: dto.branchId,
          productId: dto.productId,
          deletedAt: null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Inventory item already exists for this product and branch',
        );
      }
    }

    const item = await this.prisma.inventoryItem.create({
      data: dto,
      include: { product: { include: { category: true } } },
    });
    this.realtime.emitInventoryEvent(item.branchId, 'inventory.stock.changed', {
      id: item.id,
      productId: item.productId,
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
    });
    return item;
  }

  async update(id: string, dto: UpdateInventoryItemDto, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: dto,
      include: { product: { include: { category: true } } },
    });
    this.realtime.emitInventoryEvent(item.branchId, 'inventory.stock.changed', {
      id: item.id,
      productId: item.productId,
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
    });
    return item;
  }

  async recordMovement(
    dto: InventoryMovementDto,
    branchId?: string,
    userId?: string,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    if (!userId) throw new BadRequestException('userId is required');
    this.validateMovement(dto);

    return this.prisma.$transaction(async (tx) => {
      const item = await this.resolveInventoryItem(tx, dto, branchId);
      return this.applyMovement(tx, {
        inventoryItemId: item.id,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        notes: dto.notes,
        reference: dto.reference,
        userId,
      });
    });
  }

  async discountOrderStock(orderId: string, branchId: string, userId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId, deletedAt: null },
        include: {
          items: {
            include: {
              product: {
                include: {
                  inventoryItems: {
                    where: { branchId, deletedAt: null, isActive: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (order.inventoryDiscountedAt) return { skipped: true };

      for (const orderItem of order.items) {
        if (!orderItem.product.trackInventory) continue;
        const inventoryItem = orderItem.product.inventoryItems[0];
        if (!inventoryItem) {
          throw new BadRequestException(
            `Inventory item not configured for product ${orderItem.product.name}`,
          );
        }
        await this.applyMovement(tx, {
          inventoryItemId: inventoryItem.id,
          type: MovementType.OUT,
          quantity: orderItem.quantity,
          reason: 'Venta',
          notes: `Descuento automatico por orden ${order.orderNumber}`,
          reference: order.id,
          userId,
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { inventoryDiscountedAt: new Date() },
      });

      return { skipped: false };
    });
  }

  async reverseOrderStock(orderId: string, branchId: string, userId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId, deletedAt: null },
        include: {
          items: {
            include: {
              product: {
                include: {
                  inventoryItems: {
                    where: { branchId, deletedAt: null, isActive: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (!order.inventoryDiscountedAt) return { skipped: true };
      if (order.status !== OrderStatus.CANCELLED) return { skipped: true };

      for (const orderItem of order.items) {
        if (!orderItem.product.trackInventory) continue;
        const inventoryItem = orderItem.product.inventoryItems[0];
        if (!inventoryItem) continue;
        await this.applyMovement(tx, {
          inventoryItemId: inventoryItem.id,
          type: MovementType.IN,
          quantity: orderItem.quantity,
          reason: 'Cancelacion de orden',
          notes: `Reversa automatica por orden ${order.orderNumber}`,
          reference: `${order.id}:reverse`,
          userId,
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { inventoryDiscountedAt: null },
      });

      return { skipped: false };
    });
  }

  private async resolveInventoryItem(
    tx: Prisma.TransactionClient,
    dto: InventoryMovementDto,
    branchId: string,
  ) {
    if (!dto.inventoryItemId && !dto.productId) {
      throw new BadRequestException('inventoryItemId or productId is required');
    }

    const item = await tx.inventoryItem.findFirst({
      where: {
        ...(dto.inventoryItemId ? { id: dto.inventoryItemId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {}),
        deletedAt: null,
        branchId,
      },
    });

    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  private validateMovement(dto: InventoryMovementDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    const requiresReason = new Set<MovementType>([
      MovementType.OUT,
      MovementType.ADJUSTMENT,
      MovementType.WASTE,
    ]);
    if (requiresReason.has(dto.type) && !dto.reason?.trim()) {
      throw new BadRequestException('Reason is required for this movement');
    }
  }

  private async applyMovement(
    tx: Prisma.TransactionClient,
    dto: {
      inventoryItemId: string;
      type: MovementType;
      quantity: number;
      reason?: string;
      notes?: string;
      reference?: string;
      userId?: string;
    },
  ) {
    const item = await tx.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, deletedAt: null, isActive: true },
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
        newStock = dto.quantity;
        break;
      case MovementType.TRANSFER:
        throw new BadRequestException(
          'Transfer movements are not supported yet',
        );
      default:
        newStock = currentStock;
    }

    const [movement] = await Promise.all([
      tx.inventoryMovement.create({
        data: {
          inventoryItemId: dto.inventoryItemId,
          type: dto.type,
          quantity: dto.quantity,
          previousStock: currentStock,
          newStock,
          reason: dto.reason,
          notes: dto.notes,
          reference: dto.reference,
          userId: dto.userId,
        },
      }),
      tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: newStock },
      }),
    ]);

    const payload = {
      id: item.id,
      productId: item.productId,
      currentStock: newStock,
      minStock: Number(item.minStock),
      unit: item.unit,
    };
    this.realtime.emitInventoryEvent(
      item.branchId,
      'inventory.stock.changed',
      payload,
    );
    if (newStock <= Number(item.minStock)) {
      this.realtime.emitInventoryEvent(
        item.branchId,
        'inventory.low_stock',
        payload,
      );
    }

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
