import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, PreparationStation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintTicketDocument, PrintTicketType } from './print.types';

@Injectable()
export class PrintService {
  constructor(private prisma: PrismaService) {}

  async getCustomerTicket(
    orderId: string,
    branchId: string,
  ): Promise<PrintTicketDocument> {
    const order = await this.getOrder(orderId, branchId);
    return this.buildDocument(order, 'CUSTOMER');
  }

  async getKitchenTicket(
    orderId: string,
    branchId: string,
  ): Promise<PrintTicketDocument> {
    const order = await this.getOrder(orderId, branchId);
    return this.buildDocument(order, 'KITCHEN');
  }

  async getBarTicket(
    orderId: string,
    branchId: string,
  ): Promise<PrintTicketDocument> {
    const order = await this.getOrder(orderId, branchId);
    return this.buildDocument(order, 'BAR');
  }

  private async getOrder(orderId: string, branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId, deletedAt: null },
      include: {
        branch: {
          include: {
            settings: {
              where: { group: { in: ['print', 'ticket', 'general'] } },
            },
          },
        },
        table: true,
        user: true,
        items: {
          include: {
            product: { include: { category: true } },
            modifiers: { include: { modifier: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private buildDocument(
    order: Awaited<ReturnType<PrintService['getOrder']>>,
    type: PrintTicketType,
  ): PrintTicketDocument {
    const settings = new Map(
      order.branch.settings.map((setting) => [setting.key, setting.value]),
    );
    const width = settings.get('ticket_width') === '58mm' ? '58mm' : '80mm';
    const station =
      type === 'KITCHEN'
        ? PreparationStation.KITCHEN
        : type === 'BAR'
          ? PreparationStation.BAR
          : null;
    const items = order.items
      .filter((item) => !station || item.product.preparationStation === station)
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: item.product.name,
        category: item.product.category?.name ?? null,
        notes: item.notes,
        unitPrice: type === 'CUSTOMER' ? Number(item.unitPrice) : undefined,
        totalPrice: type === 'CUSTOMER' ? Number(item.totalPrice) : undefined,
        modifiers: item.modifiers.map((modifier) => ({
          name: modifier.modifier.name,
          quantity: modifier.quantity,
          price: type === 'CUSTOMER' ? Number(modifier.price) : undefined,
        })),
      }));

    const paid = order.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const changeAmount = order.payments.reduce(
      (sum, payment) => sum + Number(payment.change ?? 0),
      0,
    );

    return {
      type,
      width,
      config: {
        businessName:
          settings.get('business_name') ??
          settings.get('ticket_business_name') ??
          order.branch.name,
        branchName: order.branch.name,
        address: settings.get('ticket_address') ?? order.branch.address ?? null,
        phone: settings.get('ticket_phone') ?? order.branch.phone ?? null,
        ticketMessage:
          settings.get('ticket_message') ?? 'Gracias por su compra',
        kitchenPrinter: settings.get('printer_kitchen') ?? null,
        barPrinter: settings.get('printer_bar') ?? null,
        cashierPrinter: settings.get('printer_cashier') ?? null,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        table: order.table?.number ?? null,
        cashier: this.formatUser(order.user),
        waiter: this.formatUser(order.user),
        notes: order.notes,
      },
      items,
      payments:
        type === 'CUSTOMER'
          ? order.payments.map((payment) => ({
              id: payment.id,
              method: payment.method,
              amount: Number(payment.amount),
              receivedAmount:
                payment.receivedAmount === null
                  ? null
                  : Number(payment.receivedAmount),
              changeAmount: Number(payment.change ?? 0),
              reference: payment.reference,
            }))
          : undefined,
      totals:
        type === 'CUSTOMER'
          ? {
              subtotal: Number(order.subtotal),
              taxAmount: Number(order.taxAmount),
              discountAmount: Number(order.discountAmount),
              tipAmount: Number(order.tipAmount),
              total: Number(order.total),
              paid,
              changeAmount,
            }
          : undefined,
    };
  }

  private formatUser(user: { firstName: string; lastName: string } | null) {
    if (!user) return null;
    return `${user.firstName} ${user.lastName}`.trim();
  }
}
