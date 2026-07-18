import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus, PaymentStatus, TableStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private inventoryService: InventoryService,
  ) {}

  async findAll(branchId?: string, status?: OrderStatus) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
      },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, branchId?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: this.orderInclude(),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto, userId: string) {
    if (!dto.branchId) throw new BadRequestException('branchId is required');
    if (dto.tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: {
          id: dto.tableId,
          deletedAt: null,
          area: { branchId: dto.branchId },
        },
        select: { id: true },
      });
      if (!table) {
        throw new BadRequestException('Table does not belong to this branch');
      }
    }

    const { subtotal, itemsData } = await this.buildOrderItems(dto.items);
    const taxAmount = subtotal * 0; // Tax handled at item level if needed
    const total = subtotal + taxAmount;
    const orderNumber = `PC-${Date.now().toString(36).toUpperCase()}`;

    const order = await this.prisma.order.create({
      data: {
        branchId: dto.branchId,
        tableId: dto.tableId,
        userId,
        orderNumber,
        status: OrderStatus.PENDING,
        notes: dto.notes,
        subtotal,
        taxAmount,
        discountAmount: 0,
        total,
        isDelivery: dto.isDelivery ?? false,
        isTakeaway: dto.isTakeaway ?? false,
        deliveryAddress: dto.deliveryAddress,
        items: { create: itemsData as never },
      },
      include: this.orderInclude(),
    });

    // Mark table as occupied if applicable
    if (dto.tableId) {
      await this.prisma.restaurantTable.update({
        where: { id: dto.tableId },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    await this.audit.record({
      branchId: order.branchId,
      userId,
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        total: Number(order.total),
      },
    });

    return order;
  }

  private orderInclude() {
    return {
      table: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      items: {
        include: {
          product: true,
          modifiers: { include: { modifier: true } },
        },
      },
      payments: true,
    };
  }

  private async buildOrderItems(items: CreateOrderItemDto[]) {
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const itemsData: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      notes?: string;
      modifiers: {
        create: Array<{ modifierId: string; quantity: number; price: unknown }>;
      };
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product)
        throw new NotFoundException(`Product ${item.productId} not found`);

      const unitPrice = Number(product.price);
      let itemModifiersTotal = 0;

      const modifiersCreate: Array<{
        modifierId: string;
        quantity: number;
        price: unknown;
      }> = [];
      if (item.modifiers?.length) {
        const modifierIds = item.modifiers.map((m) => m.modifierId);
        const modifiers = await this.prisma.modifier.findMany({
          where: { id: { in: modifierIds } },
        });
        const modifierMap = new Map(modifiers.map((m) => [m.id, m]));

        for (const mod of item.modifiers) {
          const modifier = modifierMap.get(mod.modifierId);
          if (modifier) {
            const modPrice = Number(modifier.price) * (mod.quantity ?? 1);
            itemModifiersTotal += modPrice;
            modifiersCreate.push({
              modifierId: mod.modifierId,
              quantity: mod.quantity ?? 1,
              price: modifier.price,
            });
          }
        }
      }

      const totalPrice = (unitPrice + itemModifiersTotal) * item.quantity;
      subtotal += totalPrice;

      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        notes: item.notes,
        modifiers: { create: modifiersCreate },
      });
    }

    return { subtotal, itemsData };
  }

  async addItems(
    id: string,
    items: CreateOrderItemDto[],
    branchId?: string,
    userId?: string,
  ) {
    if (!items.length) throw new BadRequestException('items are required');
    const order = await this.findOne(id, branchId);
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot add items to a closed order');
    }
    const totalPaid = order.payments
      .filter((payment) => payment.status === PaymentStatus.COMPLETED)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (Number(order.total) > 0 && totalPaid >= Number(order.total)) {
      throw new BadRequestException('Cannot add items to a paid order');
    }

    const { subtotal: itemsSubtotal, itemsData } =
      await this.buildOrderItems(items);
    const nextSubtotal = Number(order.subtotal) + itemsSubtotal;
    const nextTaxAmount = Number(order.taxAmount);
    const nextTotal =
      nextSubtotal + nextTaxAmount - Number(order.discountAmount);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        subtotal: nextSubtotal,
        total: nextTotal,
        status: OrderStatus.PREPARING,
        items: { create: itemsData as never },
      },
      include: this.orderInclude(),
    });

    if (updatedOrder.tableId) {
      await this.prisma.restaurantTable.update({
        where: { id: updatedOrder.tableId },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    await this.audit.record({
      branchId: updatedOrder.branchId,
      userId,
      action: 'ORDER_ITEMS_ADDED',
      entity: 'Order',
      entityId: updatedOrder.id,
      metadata: {
        orderNumber: updatedOrder.orderNumber,
        itemCount: items.length,
        total: Number(updatedOrder.total),
      },
    });

    return updatedOrder;
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderDto,
    branchId?: string,
    userId?: string,
  ) {
    const order = await this.findOne(id, branchId);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        ...(dto.status === OrderStatus.COMPLETED
          ? { completedAt: new Date() }
          : {}),
        ...(dto.status === OrderStatus.CANCELLED
          ? { cancelledAt: new Date() }
          : {}),
      },
      include: {
        table: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    // Free table when order is completed or cancelled
    if (
      order.tableId &&
      (dto.status === OrderStatus.COMPLETED ||
        dto.status === OrderStatus.CANCELLED)
    ) {
      await this.prisma.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    if (dto.status === OrderStatus.COMPLETED) {
      await this.inventoryService.discountOrderStock(
        updatedOrder.id,
        updatedOrder.branchId,
        userId,
      );
    }

    if (dto.status === OrderStatus.CANCELLED) {
      await this.inventoryService.reverseOrderStock(
        updatedOrder.id,
        updatedOrder.branchId,
        userId,
      );
    }

    await this.audit.record({
      branchId: updatedOrder.branchId,
      userId,
      action: 'ORDER_STATUS_CHANGED',
      entity: 'Order',
      entityId: updatedOrder.id,
      metadata: {
        previousStatus: order.status,
        status: updatedOrder.status,
        orderNumber: updatedOrder.orderNumber,
      },
    });

    return updatedOrder;
  }

  async cancel(id: string, branchId?: string, userId?: string) {
    return this.updateStatus(
      id,
      { status: OrderStatus.CANCELLED },
      branchId,
      userId,
    );
  }

  async getDailySummary(branchId: string, date?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: start, lte: end },
      },
      include: { payments: true },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return { totalRevenue, totalOrders, avgOrderValue, date: start };
  }
}
