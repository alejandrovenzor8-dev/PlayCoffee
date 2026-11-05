import { isTransactionConflict } from '../../common/transaction-conflict';
import { CorrectOrderItemDto } from './dto/correct-order-item.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TableStatus,
  UserRoleEnum,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrintService } from '../print/print.service';

const MONEY_SCALE = 100;
type OrderDbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private inventoryService: InventoryService,
    private printService: PrintService,
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
    const order = await this.prisma
      .$transaction(async (tx) => {
        if (dto.requestId) {
          const previous = await tx.order.findUnique({
            where: { requestId: dto.requestId },
            include: this.orderInclude(),
          });
          if (previous) {
            if (previous.branchId !== dto.branchId)
              throw new ConflictException('Referencia de otra sucursal');
            return previous;
          }
        }
        if (dto.tableId) {
          await tx.$queryRaw`SELECT id FROM restaurant_tables WHERE id = ${dto.tableId} FOR UPDATE`;
          const table = await tx.restaurantTable.findFirst({
            where: {
              id: dto.tableId,
              deletedAt: null,
              area: { branchId: dto.branchId },
            },
            select: { id: true },
          });
          if (!table) {
            throw new BadRequestException(
              'Table does not belong to this branch',
            );
          }
        }

        if (dto.tableId) {
          const active = await tx.order.findFirst({
            where: {
              tableId: dto.tableId,
              deletedAt: null,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
            },
          });
          if (active)
            throw new ConflictException(
              'La mesa ya tiene una orden activa. Actualiza y agrega productos a ese ticket.',
            );
        }
        const { subtotal, itemsData } = await this.buildOrderItems(
          dto.items,
          tx,
        );
        const taxAmount = subtotal * 0; // Tax handled at item level if needed
        const total = subtotal + taxAmount;
        const orderNumber = this.createOrderNumber();

        const createdOrder = await tx.order.create({
          data: {
            branchId: dto.branchId,
            requestId: dto.requestId,
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

        if (dto.tableId) {
          await tx.restaurantTable.update({
            where: { id: dto.tableId },
            data: { status: TableStatus.OCCUPIED },
          });
        }

        return createdOrder;
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code)
        ) {
          throw new ConflictException(
            'La mesa cambió en otro dispositivo. Actualiza antes de reintentar.',
          );
        }
        throw error;
      });

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

    await this.printService.queueProductionTickets(
      order.id,
      order.branchId,
      order.items.map((item) => item.id),
    );

    return order;
  }

  private orderInclude() {
    return {
      table: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      items: {
        where: { status: { not: OrderStatus.CANCELLED } },
        include: {
          product: true,
          modifiers: { include: { modifier: true } },
        },
      },
      payments: true,
    };
  }

  private async buildOrderItems(
    items: CreateOrderItemDto[],
    db: OrderDbClient = this.prisma,
  ) {
    const normalizedItems = this.consolidateOrderItems(items);
    const productIds = normalizedItems.map((i) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      include: {
        modifiers: {
          include: { modifier: true },
        },
      },
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

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);
      if (!product)
        throw new NotFoundException(`Product ${item.productId} not found`);
      if (!product.isActive) {
        throw new BadRequestException(
          `Product ${product.name} is inactive and cannot be added to an order`,
        );
      }

      const unitPrice = Number(product.price);
      let itemModifiersTotal = 0;

      const modifiersCreate: Array<{
        modifierId: string;
        quantity: number;
        price: unknown;
      }> = [];
      if (item.modifiers?.length) {
        const modifierMap = new Map(
          product.modifiers
            .filter(
              ({ modifier }) =>
                modifier.isActive && modifier.deletedAt === null,
            )
            .map(({ modifier }) => [modifier.id, modifier]),
        );

        for (const mod of item.modifiers) {
          const modifier = modifierMap.get(mod.modifierId);
          if (!modifier) {
            throw new BadRequestException(
              `Modifier ${mod.modifierId} is not available for product ${product.name}`,
            );
          }
          const modPrice = Number(modifier.price) * (mod.quantity ?? 1);
          itemModifiersTotal += modPrice;
          modifiersCreate.push({
            modifierId: mod.modifierId,
            quantity: mod.quantity ?? 1,
            price: modifier.price,
          });
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

  private consolidateOrderItems(items: CreateOrderItemDto[]) {
    const itemMap = new Map<string, CreateOrderItemDto>();

    for (const item of items) {
      const modifiers = [...(item.modifiers ?? [])].sort((a, b) => {
        const modifierCompare = a.modifierId.localeCompare(b.modifierId);
        if (modifierCompare !== 0) return modifierCompare;
        return (a.quantity ?? 1) - (b.quantity ?? 1);
      });
      const key = JSON.stringify({
        productId: item.productId,
        notes: item.notes ?? null,
        modifiers,
      });
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        itemMap.set(key, { ...item, modifiers });
      }
    }

    return [...itemMap.values()];
  }

  async addItems(
    id: string,
    items: CreateOrderItemDto[],
    branchId?: string,
    userId?: string,
    requestId?: string,
  ) {
    if (!items.length) throw new BadRequestException('items are required');
    if (!branchId) throw new BadRequestException('branchId is required');
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} AND "branchId" = ${branchId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id, branchId, deletedAt: null },
        include: this.orderInclude(),
      });
      if (!order) throw new NotFoundException('Order not found');
      if (requestId) {
        const previous = await tx.orderSubmission.findUnique({
          where: { id: requestId },
        });
        if (previous) {
          if (previous.orderId !== id || previous.branchId !== branchId)
            throw new ConflictException('Referencia de otro ticket');
          return order;
        }
        await tx.orderSubmission.create({
          data: { id: requestId, orderId: id, branchId },
        });
      }
      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.COMPLETED
      ) {
        throw new BadRequestException('Cannot add items to a closed order');
      }
      const summary = this.getPaymentSummary(order.total, order.payments);
      if (summary.totalCents > 0 && summary.remainingCents <= 0) {
        throw new BadRequestException('Cannot add items to a paid order');
      }

      const { subtotal: itemsSubtotal, itemsData } = await this.buildOrderItems(
        items,
        tx,
      );
      const nextSubtotal = Number(order.subtotal) + itemsSubtotal;
      const nextTaxAmount = Number(order.taxAmount);
      const nextTotal =
        nextSubtotal +
        nextTaxAmount +
        Number(order.tipAmount) -
        Number(order.discountAmount);

      const changedOrder = await tx.order.update({
        where: { id },
        data: {
          subtotal: nextSubtotal,
          total: nextTotal,
          status: OrderStatus.PREPARING,
          items: { create: itemsData as never },
        },
        include: this.orderInclude(),
      });

      if (changedOrder.tableId) {
        await tx.restaurantTable.update({
          where: { id: changedOrder.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      return changedOrder;
    });

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

    await this.printService.queueProductionTickets(
      updatedOrder.id,
      updatedOrder.branchId,
      updatedOrder.items.map((item) => item.id),
    );

    return updatedOrder;
  }

  async correctItem(
    id: string,
    itemId: string,
    dto: CorrectOrderItemDto,
    branchId: string,
    userId: string,
    role: UserRoleEnum,
  ) {
    if (!branchId || !userId)
      throw new BadRequestException('Sucursal y usuario requeridos');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} AND "branchId" = ${branchId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id, branchId, deletedAt: null },
        include: {
          payments: true,
          items: { include: { product: true, modifiers: true } },
        },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (
        ['COMPLETED', 'CANCELLED'].includes(order.status) ||
        order.payments.some((p) => p.status === 'COMPLETED') ||
        order.inventoryDiscountedAt
      ) {
        throw new ConflictException(
          'La orden tiene pagos o está cerrada. Usa el flujo de devolución.',
        );
      }
      const item = order.items.find(
        (i) => i.id === itemId && i.status !== 'CANCELLED',
      );
      if (!item) throw new NotFoundException('Producto no encontrado');
      if (
        await tx.childAccess.count({
          where: {
            OR: [{ baseOrderItemId: itemId }, { extraOrderItemId: itemId }],
          },
        })
      ) {
        throw new ConflictException(
          'Corrige este cargo desde Control infantil.',
        );
      }
      const dispatched =
        ['QUEUED', 'SENT'].includes(item.preparationStatus) ||
        (item.preparationStatus === 'LEGACY' &&
          item.product.preparationStation !== 'NONE');
      if (dispatched && !['ADMIN', 'SUPER_ADMIN', 'CASHIER'].includes(role))
        throw new ForbiddenException('Requiere autorización ADMIN/CASHIER');
      if (dispatched) {
        const job = item.preparationJobId
          ? await tx.printJob.findUnique({
              where: { id: item.preparationJobId },
            })
          : null;
        if (job && ['PENDING', 'PROCESSING'].includes(job.status))
          throw new ConflictException(
            'Espera a que termine el envío de esta comanda.',
          );
        await this.printService.queueCancellation(
          tx,
          id,
          branchId,
          itemId,
          dto.reason,
        );
      }
      // Keep the original line and its dispatch history; a correction creates a new pending line.
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: OrderStatus.CANCELLED },
      });
      const unitTotal = Number(item.totalPrice) / item.quantity;
      const replacement =
        dto.quantity > 0
          ? await tx.orderItem.create({
              data: {
                orderId: id,
                productId: item.productId,
                quantity: dto.quantity,
                unitPrice: item.unitPrice,
                totalPrice: Math.round(unitTotal * dto.quantity * 100) / 100,
                notes: dto.notes ?? item.notes,
                modifiers: {
                  create: item.modifiers.map((m) => ({
                    modifierId: m.modifierId,
                    quantity: m.quantity,
                    price: m.price,
                  })),
                },
              },
            })
          : null;
      const subtotal =
        Math.round(
          (Number(order.subtotal) -
            Number(item.totalPrice) +
            unitTotal * dto.quantity) *
            100,
        ) / 100;
      await tx.order.update({
        where: { id },
        data: {
          subtotal,
          total:
            subtotal +
            Number(order.taxAmount) +
            Number(order.tipAmount) -
            Number(order.discountAmount),
        },
      });
      await tx.auditLog.create({
        data: {
          branchId,
          userId,
          action: 'ORDER_ITEM_CORRECTED',
          entity: 'OrderItem',
          entityId: itemId,
          metadata: {
            reason: dto.reason,
            orderId: id,
            previousQuantity: item.quantity,
            previousNotes: item.notes,
            quantity: dto.quantity,
            notes: dto.notes ?? item.notes,
            replacementId: replacement?.id ?? null,
            dispatched,
          },
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: this.orderInclude(),
      });
    });
  }

  private createOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const entropy = randomUUID().slice(0, 6).toUpperCase();
    return `PC-${timestamp}-${entropy}`;
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderDto,
    branchId?: string,
    userId?: string,
  ) {
    const { order, updatedOrder, nextStatus } = await this.prisma
      .$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} AND "branchId" = ${branchId} FOR UPDATE`;
          const order = await tx.order.findFirst({
            where: { id, branchId, deletedAt: null },
            include: this.orderInclude(),
          });
          if (!order) throw new NotFoundException('Order not found');
          if (
            [OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(
              order.status as 'COMPLETED' | 'CANCELLED',
            )
          )
            throw new ConflictException('La orden está cerrada');
          if (
            dto.status === OrderStatus.CANCELLED &&
            order.items.some(
              (i) =>
                ['QUEUED', 'SENT'].includes(i.preparationStatus) ||
                (i.preparationStatus === 'LEGACY' &&
                  i.product.preparationStation !== 'NONE'),
            )
          ) {
            throw new ConflictException(
              'Cancela primero los productos enviados mediante una corrección autorizada.',
            );
          }
          if (
            dto.status === OrderStatus.CANCELLED ||
            dto.status === OrderStatus.COMPLETED
          ) {
            const activeChild = await tx.childAccess.count({
              where: { orderId: id, exitTime: null },
            });
            if (activeChild)
              throw new ConflictException(
                'Registra la salida infantil antes de cerrar la cuenta.',
              );
          }
          if (dto.status) {
            this.assertStatusChangeAllowed(order, dto.status);
          }
          const paid =
            this.getPaymentSummary(order.total, order.payments)
              .remainingCents === 0;
          const nextStatus =
            dto.status === OrderStatus.DELIVERED && paid
              ? OrderStatus.COMPLETED
              : dto.status;

          const updatedOrder = await tx.order.update({
            where: { id },
            data: {
              ...(nextStatus ? { status: nextStatus } : {}),
              notes: dto.notes,
              ...(nextStatus === OrderStatus.COMPLETED
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
            (nextStatus === OrderStatus.COMPLETED ||
              dto.status === OrderStatus.CANCELLED)
          ) {
            await tx.restaurantTable.update({
              where: { id: order.tableId },
              data: { status: TableStatus.AVAILABLE },
            });
          }

          return { order, updatedOrder, nextStatus };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => {
        if (isTransactionConflict(error)) {
          throw new ConflictException(
            'La orden cambió en otro dispositivo. Actualiza e intenta nuevamente.',
          );
        }
        throw error;
      });

    if (nextStatus === OrderStatus.COMPLETED) {
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

  private assertStatusChangeAllowed(
    order: Awaited<ReturnType<OrdersService['findOne']>>,
    nextStatus: OrderStatus,
  ) {
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot change a completed order');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change a cancelled order');
    }
    if (
      nextStatus === OrderStatus.CANCELLED &&
      order.payments.some(
        (payment) => payment.status === PaymentStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException(
        'No se puede cancelar una orden con pagos registrados.',
      );
    }
    if (nextStatus !== OrderStatus.COMPLETED) return;

    const summary = this.getPaymentSummary(order.total, order.payments);
    if (summary.remainingCents > 0) {
      throw new ConflictException(
        'La orden todavía tiene un saldo pendiente y no puede completarse',
      );
    }
  }

  private getPaymentSummary(
    totalValue: unknown,
    payments: Array<{ amount: unknown; status: PaymentStatus }>,
  ) {
    const totalCents = this.toMoneyCents(totalValue);
    const paidCents = payments
      .filter((payment) => payment.status === PaymentStatus.COMPLETED)
      .reduce((sum, payment) => sum + this.toMoneyCents(payment.amount), 0);

    return {
      totalCents,
      paidCents,
      remainingCents: Math.max(0, totalCents - paidCents),
    };
  }

  private toMoneyCents(value: unknown) {
    return Math.round(Number(value) * MONEY_SCALE);
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
