import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus, OrderStatus, TableStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePaymentDto, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId, deletedAt: null },
      include: { payments: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    const alreadyPaid = order.payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    if (alreadyPaid >= Number(order.total)) {
      throw new BadRequestException('Order is already fully paid');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        method: dto.method,
        amount: dto.amount,
        tipAmount: dto.tipAmount ?? 0,
        status: PaymentStatus.COMPLETED,
        processedAt: new Date(),
        reference: dto.reference,
        change: Math.max(0, dto.amount - (Number(order.total) - alreadyPaid)),
      },
    });

    // Check if order is now fully paid
    const newTotal = alreadyPaid + dto.amount;
    if (newTotal >= Number(order.total)) {
      await this.prisma.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
      });

      if (order.tableId) {
        await this.prisma.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }
    }

    await this.audit.record({
      branchId: order.branchId,
      userId,
      action: 'PAYMENT_COMPLETED',
      entity: 'Payment',
      entityId: payment.id,
      metadata: {
        orderId: order.id,
        method: payment.method,
        amount: Number(payment.amount),
        orderCompleted: newTotal >= Number(order.total),
      },
    });

    return payment;
  }

  async findByOrder(orderId: string) {
    return this.prisma.payment.findMany({ where: { orderId } });
  }
}
