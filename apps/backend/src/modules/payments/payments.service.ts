import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  TableStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';

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

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: dto.orderId,
          deletedAt: null,
          branchId,
        },
        include: { payments: true },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cancelled orders cannot be paid');
      }

      const currentSummary = this.buildSummary(
        order.id,
        order.total,
        order.payments,
      );

      if (currentSummary.paymentStatus === 'PAID') {
        throw new BadRequestException('Order is already fully paid');
      }

      const roundedRemaining = this.roundMoney(currentSummary.remainingAmount);
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
        await tx.order.update({
          where: { id: dto.orderId },
          data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
        });

        if (order.tableId) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        }
      }

      return { order, payment: this.serializePayment(payment), summary };
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
}
