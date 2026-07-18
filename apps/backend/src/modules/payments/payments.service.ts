import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  TableStatus,
  MovementType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type PaymentSummaryStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

type PaymentWithSummary = {
  payment: unknown;
  summary: {
    orderId: string;
    total: number;
    totalPaid: number;
    remainingAmount: number;
    changeAmount: number;
    paymentStatus: PaymentSummaryStatus;
  };
};

const splitPaymentMethods = new Set<PaymentMethod>([
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
]);

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private realtime: RealtimeGateway,
  ) {}

  async create(
    dto: CreatePaymentDto,
    userId?: string,
    branchId?: string,
  ): Promise<PaymentWithSummary> {
    if (!branchId) throw new BadRequestException('branchId is required');
    if (!userId) throw new BadRequestException('userId is required');
    if (!splitPaymentMethods.has(dto.method)) {
      throw new BadRequestException('Unsupported payment method');
    }
    if (dto.amount <= 0)
      throw new BadRequestException('Payment amount must be greater than zero');

    const result = await this.prisma
      .$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: {
              id: dto.orderId,
              deletedAt: null,
              branchId,
            },
            include: {
              payments: true,
              items: {
                include: {
                  product: {
                    include: {
                      inventoryItems: {
                        where: { branchId, deletedAt: null, isActive: true },
                        select: {
                          id: true,
                          currentStock: true,
                          minStock: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          if (!order) throw new NotFoundException('Order not found');
          if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('Cancelled orders cannot be paid');
          }
          if (order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException('Order is already fully paid');
          }

          const currentSummary = this.buildSummary(
            order.id,
            order.total,
            order.payments,
          );

          if (currentSummary.paymentStatus === 'PAID') {
            throw new BadRequestException('Order is already fully paid');
          }

          const roundedRemaining = this.roundMoney(
            currentSummary.remainingAmount,
          );
          const requestedAmount = this.roundMoney(dto.amount);
          let appliedAmount = requestedAmount;
          let receivedAmount =
            dto.receivedAmount === undefined
              ? undefined
              : this.roundMoney(dto.receivedAmount);
          let changeAmount = 0;

          if (dto.method === PaymentMethod.CASH) {
            receivedAmount = receivedAmount ?? requestedAmount;
            if (receivedAmount <= 0) {
              throw new BadRequestException(
                'Received cash amount must be greater than zero',
              );
            }
            appliedAmount = Math.min(receivedAmount, roundedRemaining);
            changeAmount = this.roundMoney(
              Math.max(0, receivedAmount - roundedRemaining),
            );
          } else {
            if (requestedAmount > roundedRemaining) {
              throw new BadRequestException(
                'Card or transfer amount cannot exceed remaining balance',
              );
            }
            appliedAmount = requestedAmount;
          }

          if (appliedAmount <= 0) {
            throw new BadRequestException(
              'Applied payment amount must be greater than zero',
            );
          }

          const shift = await tx.shift.findFirst({
            where: { branchId: order.branchId, closedAt: null },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          });

          const payment = await tx.payment.create({
            data: {
              orderId: dto.orderId,
              shiftId: shift?.id,
              userId,
              method: dto.method,
              amount: appliedAmount,
              receivedAmount,
              tipAmount: dto.tipAmount ?? 0,
              status: PaymentStatus.COMPLETED,
              processedAt: new Date(),
              reference: dto.reference,
              change: changeAmount,
            },
          });

          const summary = this.buildSummary(order.id, order.total, [
            ...order.payments,
            payment,
          ]);

          if (summary.paymentStatus === 'PAID') {
            await this.discountInventoryForPaidOrder(tx, order, userId);

            await tx.order.update({
              where: { id: dto.orderId },
              data: {
                status: OrderStatus.COMPLETED,
                completedAt: new Date(),
                inventoryDiscountedAt:
                  order.inventoryDiscountedAt ?? new Date(),
              },
            });

            if (order.tableId) {
              await tx.restaurantTable.update({
                where: { id: order.tableId },
                data: { status: TableStatus.AVAILABLE },
              });
            }
          }

          return { order, payment: this.serializePayment(payment), summary };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error: unknown) => {
        if (this.isTransactionWriteConflict(error)) {
          throw new ConflictException(
            'Payment could not be processed because the order changed. Please retry.',
          );
        }
        throw error;
      });

    await this.audit.record({
      branchId: result.order.branchId,
      userId,
      action: 'PAYMENT_COMPLETED',
      entity: 'Payment',
      entityId: result.payment.id,
      metadata: {
        orderId: result.order.id,
        method: result.payment.method,
        amount: result.payment.amount,
        receivedAmount: result.payment.receivedAmount,
        changeAmount: result.payment.changeAmount,
        orderCompleted: result.summary.paymentStatus === 'PAID',
      },
    });

    this.realtime.emitPaymentEvent(result.order.branchId, 'payment.created', {
      id: result.payment.id,
      orderId: result.order.id,
      method: result.payment.method,
      amount: result.payment.amount,
    });
    this.realtime.emitPaymentEvent(
      result.order.branchId,
      'order.payment_status.changed',
      result.summary,
    );
    if (result.summary.paymentStatus === 'PAID') {
      this.realtime.emitOrderEvent(result.order.branchId, 'order.completed', {
        id: result.order.id,
        status: OrderStatus.COMPLETED,
      });
    }

    return {
      payment: result.payment,
      summary: result.summary,
    };
  }

  async findByOrder(orderId: string, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null, branchId },
      include: {
        payments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      payments: order.payments.map((payment) => this.serializePayment(payment)),
      summary: this.buildSummary(order.id, order.total, order.payments),
    };
  }

  private buildSummary(
    orderId: string,
    totalValue: Prisma.Decimal | number,
    payments: Array<{
      amount: Prisma.Decimal | number;
      change: Prisma.Decimal | number | null;
      status: PaymentStatus;
    }>,
  ) {
    const total = this.roundMoney(Number(totalValue));
    const totalPaid = this.roundMoney(
      payments
        .filter((payment) => payment.status === PaymentStatus.COMPLETED)
        .reduce((sum, payment) => sum + Number(payment.amount), 0),
    );
    const remainingAmount = this.roundMoney(Math.max(0, total - totalPaid));
    const changeAmount = this.roundMoney(
      payments
        .filter((payment) => payment.status === PaymentStatus.COMPLETED)
        .reduce((sum, payment) => sum + Number(payment.change ?? 0), 0),
    );
    const paymentStatus: PaymentSummaryStatus =
      totalPaid <= 0
        ? 'UNPAID'
        : remainingAmount > 0
          ? 'PARTIALLY_PAID'
          : 'PAID';

    return {
      orderId,
      total,
      totalPaid,
      remainingAmount,
      changeAmount,
      paymentStatus,
    };
  }

  private serializePayment(payment: {
    id: string;
    orderId: string;
    shiftId: string | null;
    userId?: string | null;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: Prisma.Decimal | number;
    receivedAmount?: Prisma.Decimal | number | null;
    tipAmount: Prisma.Decimal | number;
    change: Prisma.Decimal | number | null;
    reference: string | null;
    processedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      shiftId: payment.shiftId,
      userId: payment.userId ?? null,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount),
      receivedAmount:
        payment.receivedAmount === undefined || payment.receivedAmount === null
          ? null
          : Number(payment.receivedAmount),
      tipAmount: Number(payment.tipAmount),
      changeAmount: Number(payment.change ?? 0),
      reference: payment.reference,
      processedAt: payment.processedAt,
      createdAt: payment.createdAt,
    };
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private isTransactionWriteConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private async discountInventoryForPaidOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      orderNumber: string;
      branchId: string;
      inventoryDiscountedAt: Date | null;
      items: Array<{
        quantity: number;
        product: {
          name: string;
          trackInventory: boolean;
          inventoryItems: Array<{
            id: string;
            currentStock: Prisma.Decimal;
            minStock: Prisma.Decimal;
          }>;
        };
      }>;
    },
    userId?: string,
  ) {
    if (order.inventoryDiscountedAt) return;

    for (const item of order.items) {
      if (!item.product.trackInventory) continue;
      const inventoryItem = item.product.inventoryItems[0];
      if (!inventoryItem) {
        throw new BadRequestException(
          `Inventory item not configured for product ${item.product.name}`,
        );
      }

      const currentStock = Number(inventoryItem.currentStock);
      const newStock = currentStock - item.quantity;
      if (newStock < 0) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.product.name}`,
        );
      }

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: inventoryItem.id,
          userId,
          type: MovementType.OUT,
          quantity: item.quantity,
          previousStock: currentStock,
          newStock,
          reason: 'Venta',
          notes: `Descuento automatico por orden ${order.orderNumber}`,
          reference: order.id,
        },
      });
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { currentStock: newStock },
      });
      const payload = {
        id: inventoryItem.id,
        currentStock: newStock,
        minStock: Number(inventoryItem.minStock),
        productName: item.product.name,
      };
      this.realtime.emitInventoryEvent(
        order.branchId,
        'inventory.stock.changed',
        payload,
      );
      if (newStock <= Number(inventoryItem.minStock)) {
        this.realtime.emitInventoryEvent(
          order.branchId,
          'inventory.low_stock',
          payload,
        );
      }
    }
  }
}
