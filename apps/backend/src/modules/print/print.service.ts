import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  PreparationStation,
  PrintJob,
  PrintJobStatus,
  PrintJobType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintTicketDocument, PrintTicketType } from './print.types';
import { UpdatePrintConfigDto } from './dto/update-print-config.dto';

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);

  constructor(private prisma: PrismaService) {}

  async getPrintConfig(branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const settings = await this.prisma.setting.findMany({
      where: {
        branchId,
        key: {
          in: [
            'printer_cashier',
            'printer_kitchen',
            'printer_bar',
            'ticket_width',
            'auto_print_kitchen',
            'auto_print_bar',
            'auto_print_customer',
          ],
        },
      },
    });
    const values = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );
    return {
      cashierPrinter: values.get('printer_cashier') ?? '',
      kitchenPrinter: values.get('printer_kitchen') ?? '',
      barPrinter: values.get('printer_bar') ?? '',
      width: values.get('ticket_width') === '58mm' ? '58mm' : '80mm',
      autoKitchen: values.get('auto_print_kitchen') !== 'false',
      autoBar: values.get('auto_print_bar') !== 'false',
      autoCustomer: values.get('auto_print_customer') !== 'false',
    };
  }

  async updatePrintConfig(branchId: string, dto: UpdatePrintConfigDto) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const targets = [dto.cashierPrinter, dto.kitchenPrinter, dto.barPrinter];
    for (const target of targets.filter(Boolean))
      this.assertPrinterTarget(target);
    const entries = [
      ['printer_cashier', dto.cashierPrinter],
      ['printer_kitchen', dto.kitchenPrinter],
      ['printer_bar', dto.barPrinter],
      ['ticket_width', dto.width],
      ['auto_print_kitchen', String(dto.autoKitchen)],
      ['auto_print_bar', String(dto.autoBar)],
      ['auto_print_customer', String(dto.autoCustomer)],
    ] as const;
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { branchId_key: { branchId, key } },
          create: { branchId, key, value, group: 'print' },
          update: { value, group: 'print' },
        }),
      ),
    );
    return this.getPrintConfig(branchId);
  }

  private assertPrinterTarget(target: string) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw new BadRequestException(`Destino de impresora inválido: ${target}`);
    }
    if (!['tcp:', 'windows:', 'file:'].includes(parsed.protocol)) {
      throw new BadRequestException(
        'La impresora debe usar tcp://, windows:/// o file:///',
      );
    }
  }

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

  async queueTicket(orderId: string, branchId: string, type: PrintJobType) {
    const order = await this.getOrder(orderId, branchId);
    const document = this.buildDocument(order, type);
    return this.queueDocument(branchId, orderId, type, document, true);
  }

  async queueProductionTickets(
    orderId: string,
    branchId: string,
    itemIds: string[],
  ) {
    try {
      const order = await this.getOrder(orderId, branchId);
      const settings = new Map(
        order.branch.settings.map((setting) => [setting.key, setting.value]),
      );
      const requested = new Set(itemIds);
      const jobs: PrintJob[] = [];
      for (const type of [PrintJobType.KITCHEN, PrintJobType.BAR]) {
        const enabledKey =
          type === PrintJobType.KITCHEN
            ? 'auto_print_kitchen'
            : 'auto_print_bar';
        if (settings.get(enabledKey) === 'false') continue;
        const document = this.buildDocument(order, type);
        document.items = document.items.filter((item) =>
          requested.has(item.id),
        );
        if (!document.items.length) continue;
        const job = await this.queueDocument(
          branchId,
          orderId,
          type,
          document,
          false,
        );
        if (job) jobs.push(job);
      }
      return jobs;
    } catch (error) {
      this.logger.error(`No se pudieron encolar comandas de ${orderId}`, error);
      return [];
    }
  }

  async queuePaidCustomerTicket(orderId: string, branchId: string) {
    try {
      const order = await this.getOrder(orderId, branchId);
      const settings = new Map(
        order.branch.settings.map((setting) => [setting.key, setting.value]),
      );
      if (settings.get('auto_print_customer') === 'false') return null;
      return this.queueDocument(
        branchId,
        orderId,
        PrintJobType.CUSTOMER,
        this.buildDocument(order, PrintJobType.CUSTOMER),
        false,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo encolar el ticket pagado ${orderId}`,
        error,
      );
      return null;
    }
  }

  private queueDocument(
    branchId: string,
    orderId: string,
    type: PrintJobType,
    document: PrintTicketDocument,
    requireTarget: boolean,
  ) {
    const printerTarget = this.getPrinterTarget(document, type);
    if (!printerTarget) {
      if (requireTarget) {
        throw new BadRequestException(
          `No hay impresora configurada para ${type.toLowerCase()}`,
        );
      }
      return null;
    }

    return this.prisma.printJob.create({
      data: {
        branchId,
        orderId,
        type,
        printerTarget,
        payload: document,
      },
    });
  }

  async claimNextJob(agentId: string) {
    await this.releaseStaleClaims();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = await this.prisma.printJob.findFirst({
        where: {
          status: PrintJobStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!candidate) return null;

      const claimed = await this.prisma.printJob.updateMany({
        where: { id: candidate.id, status: PrintJobStatus.PENDING },
        data: {
          status: PrintJobStatus.PROCESSING,
          claimedAt: new Date(),
          claimedBy: agentId,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count === 1) {
        return this.prisma.printJob.findUnique({ where: { id: candidate.id } });
      }
    }
    return null;
  }

  async completeJob(jobId: string, agentId: string) {
    const result = await this.prisma.printJob.updateMany({
      where: {
        id: jobId,
        status: PrintJobStatus.PROCESSING,
        claimedBy: agentId,
      },
      data: {
        status: PrintJobStatus.PRINTED,
        printedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        lastError: null,
      },
    });
    if (result.count !== 1) throw new ConflictException('Trabajo no reclamado');
    return { id: jobId, status: PrintJobStatus.PRINTED };
  }

  async failJob(jobId: string, agentId: string, error: string) {
    const job = await this.prisma.printJob.findFirst({
      where: {
        id: jobId,
        status: PrintJobStatus.PROCESSING,
        claimedBy: agentId,
      },
    });
    if (!job) throw new ConflictException('Trabajo no reclamado');

    const exhausted = job.attempts >= job.maxAttempts;
    const delaySeconds = Math.min(300, 2 ** Math.min(job.attempts, 8));
    return this.prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: exhausted ? PrintJobStatus.FAILED : PrintJobStatus.PENDING,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        claimedAt: null,
        claimedBy: null,
        lastError: error,
      },
    });
  }

  private async releaseStaleClaims() {
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
    await this.prisma.printJob.updateMany({
      where: {
        status: PrintJobStatus.PROCESSING,
        claimedAt: { lt: staleBefore },
      },
      data: {
        status: PrintJobStatus.PENDING,
        claimedAt: null,
        claimedBy: null,
        nextAttemptAt: new Date(),
        lastError: 'El agente anterior no confirmó la impresión',
      },
    });
  }

  private getPrinterTarget(document: PrintTicketDocument, type: PrintJobType) {
    if (type === PrintJobType.KITCHEN) return document.config.kitchenPrinter;
    if (type === PrintJobType.BAR) return document.config.barPrinter;
    return document.config.cashierPrinter;
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
