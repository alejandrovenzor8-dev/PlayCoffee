import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  OrderStatus,
  PreparationStation,
  PrintJob,
  PrintJobStatus,
  PrintJobType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintTicketDocument, PrintTicketType } from './print.types';
import { UpdatePrintConfigDto } from './dto/update-print-config.dto';
import { TestPrinterDto } from './dto/test-printer.dto';

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);

  constructor(private prisma: PrismaService) {}

  async testPrinter(branchId: string, dto: TestPrinterDto) {
    if (!branchId) throw new BadRequestException('branchId is required');
    this.assertPrinterTarget(dto.target);
    const target = new URL(dto.target);
    if (
      target.protocol === 'file:' ||
      (target.protocol === 'windows:' &&
        !decodeURIComponent(target.pathname).replace(/^\/+/, '').trim())
    ) {
      throw new BadRequestException('Selecciona una impresora local o por IP.');
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    const document: PrintTicketDocument = {
      type: dto.type,
      width: dto.width,
      config: {
        businessName: 'PRUEBA DE IMPRESION',
        branchName: branch.name,
        address: null,
        phone: null,
        ticketMessage: 'PRUEBA - SIN VALOR DE VENTA',
        kitchenPrinter: null,
        barPrinter: null,
        cashierPrinter: null,
      },
      order: {
        id: '',
        orderNumber: 'PRUEBA',
        status: 'TEST',
        createdAt: new Date(),
        table: null,
        cashier: null,
        waiter: null,
        notes: `${branch.name} - ${dto.type} - ${dto.width}. No es una venta.`,
      },
      items: [
        {
          id: 'test',
          quantity: 1,
          name: 'PRUEBA DE IMPRESION',
          category: null,
          notes: 'Texto de prueba 0123456789',
          modifiers: [],
        },
      ],
    };
    return this.prisma.printJob.create({
      data: {
        branchId,
        type: dto.type,
        printerTarget: dto.target,
        payload: document,
        maxAttempts: 1,
      },
    });
  }

  async getJobStatus(branchId: string, id: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const job = await this.prisma.printJob.findFirst({
      where: { id, branchId },
      select: { id: true, status: true, lastError: true, printedAt: true },
    });
    if (!job) throw new NotFoundException('Trabajo no encontrado');
    return job;
  }

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
            'cashier_ticket_mode',
            'confirm_close',
            'receipt_reprint_enabled',
          ],
        },
      },
    });
    const values = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );
    return {
      ...this.cashierPolicy(values),
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
    const policyEntries: Array<readonly [string, string]> = [
      ...(dto.cashierMode !== undefined
        ? [['cashier_ticket_mode', dto.cashierMode] as const]
        : []),
      ...(dto.confirmClose !== undefined
        ? [['confirm_close', String(dto.confirmClose)] as const]
        : []),
      ...(dto.allowReprint !== undefined
        ? [['receipt_reprint_enabled', String(dto.allowReprint)] as const]
        : []),
    ];
    await this.prisma.$transaction(
      [...entries, ...policyEntries].map(([key, value]) =>
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
    if (
      parsed.protocol === 'windows:' &&
      !parsed.pathname.replace(/^\/+/, '').trim()
    )
      throw new BadRequestException(
        'Indica el nombre exacto de la impresora Windows; no se usa la predeterminada.',
      );
    if (parsed.protocol === 'tcp:' && (!parsed.hostname || parsed.port === '0'))
      throw new BadRequestException('Indica IP y puerto de impresora validos.');
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
    if (order.status === OrderStatus.COMPLETED)
      return (await this.getBusinessReceipt(orderId, branchId)).document;
    return this.getPrebill(orderId, branchId);
  }

  async getKitchenTicket(
    orderId: string,
    branchId: string,
  ): Promise<PrintTicketDocument> {
    const order = await this.getOrder(orderId, branchId);
    return this.pendingPreview(order, 'KITCHEN');
  }

  async getBarTicket(
    orderId: string,
    branchId: string,
  ): Promise<PrintTicketDocument> {
    const order = await this.getOrder(orderId, branchId);
    return this.pendingPreview(order, 'BAR');
  }

  async queueTicket(orderId: string, branchId: string, type: PrintJobType) {
    if (type !== PrintJobType.CUSTOMER) {
      return this.queueNewProduction(orderId, branchId, type, true);
    }
    throw new BadRequestException(
      'Usa los flujos de precuenta o comprobante de negocio.',
    );
  }

  async queueProductionTickets(
    orderId: string,
    branchId: string,
    _itemIds: string[],
  ) {
    // Select persisted pending lines under the same lock used by manual dispatch.
    const jobs: PrintJob[] = [];
    for (const type of [PrintJobType.KITCHEN, PrintJobType.BAR]) {
      try {
        const job = await this.queueNewProduction(
          orderId,
          branchId,
          type,
          false,
        );
        if (job) jobs.push(job);
      } catch (error) {
        this.logger.error(
          `Comanda pendiente de envío: ${orderId}/${type}`,
          error,
        );
      }
    }
    return jobs;
  }

  private async queueNewProduction(
    orderId: string,
    branchId: string,
    type: PrintJobType,
    manual: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND "branchId" = ${branchId} FOR UPDATE`;
      const order = await this.getOrder(orderId, branchId, tx);
      if (
        [OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(
          order.status as 'COMPLETED' | 'CANCELLED',
        )
      ) {
        throw new ConflictException(
          'La orden está cerrada. Usa reimpresión de un lote anterior.',
        );
      }
      const settings = new Map(
        order.branch.settings.map((s) => [s.key, s.value]),
      );
      if (
        !manual &&
        settings.get(
          type === 'KITCHEN' ? 'auto_print_kitchen' : 'auto_print_bar',
        ) === 'false'
      )
        return null;
      const document = this.buildDocument(order, type);
      const pendingIds = new Set(
        order.items
          .filter(
            (i) =>
              i.preparationStatus === 'PENDING' && i.status !== 'CANCELLED',
          )
          .map((i) => i.id),
      );
      document.items = document.items.filter((i) => pendingIds.has(i.id));
      if (!document.items.length) return null;
      const job = await this.queueDocument(
        branchId,
        orderId,
        type,
        document,
        manual,
        tx,
      );
      if (!job) return null;
      await tx.orderItem.updateMany({
        where: {
          orderId,
          id: { in: document.items.map((i) => i.id) },
          preparationStatus: 'PENDING',
        },
        data: {
          preparationStatus: 'QUEUED',
          preparationJobId: job.id,
          sentAt: new Date(),
        },
      });
      return job;
    });
  }

  async listBatches(orderId: string, branchId: string) {
    await this.getOrder(orderId, branchId);
    return this.prisma.printJob.findMany({
      where: { orderId, branchId, type: { in: ['KITCHEN', 'BAR'] } },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        lastError: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reprintBatch(
    jobId: string,
    branchId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason.trim())
      throw new BadRequestException('Indica el motivo de reimpresión');
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM print_jobs WHERE id = ${jobId} AND "branchId" = ${branchId} FOR UPDATE`;
      const original = await tx.printJob.findFirst({
        where: { id: jobId, branchId },
      });
      if (
        !original?.orderId ||
        !['PRINTED', 'FAILED'].includes(original.status)
      ) {
        throw new ConflictException(
          'El lote debe estar confirmado o fallido. Revisa la impresora antes de reimprimir.',
        );
      }
      if (original.type === 'CUSTOMER')
        throw new BadRequestException(
          'Usa la reimpresion autorizada del comprobante de negocio.',
        );
      const previous = await tx.auditLog.findFirst({
        where: { entityId: jobId, action: 'PREPARATION_REPRINT' },
        orderBy: { createdAt: 'desc' },
      });
      const previousId = (previous?.metadata as { newJobId?: string } | null)
        ?.newJobId;
      if (previousId) {
        const job = await tx.printJob.findUnique({ where: { id: previousId } });
        if (job && ['PENDING', 'PROCESSING'].includes(job.status)) return job;
      }
      const document = original.payload as unknown as PrintTicketDocument;
      document.dispatch = {
        ...document.dispatch,
        kind: 'REPRINT',
        originalBatchId: jobId,
        reason,
      };
      const job = await this.queueDocument(
        branchId,
        original.orderId,
        original.type,
        document,
        true,
        tx,
      );
      if (original.status === 'FAILED')
        await tx.orderItem.updateMany({
          where: { preparationJobId: jobId, preparationStatus: 'QUEUED' },
          data: { preparationJobId: job!.id },
        });
      await tx.auditLog.create({
        data: {
          branchId,
          userId,
          action: 'PREPARATION_REPRINT',
          entity: 'PrintJob',
          entityId: jobId,
          metadata: { reason, newJobId: job!.id },
        },
      });
      return job;
    });
  }

  async queueCancellation(
    tx: Prisma.TransactionClient,
    orderId: string,
    branchId: string,
    itemId: string,
    reason: string,
  ) {
    const order = await this.getOrder(orderId, branchId, tx);
    const item = order.items.find((i) => i.id === itemId)!;
    const previousJob = item.preparationJobId
      ? await tx.printJob.findUnique({ where: { id: item.preparationJobId } })
      : null;
    const station = previousJob?.type ?? item.product.preparationStation;
    if (station === 'NONE' || station === 'CUSTOMER') return;
    const type = station as PrintJobType;
    const document = this.buildDocument(order, type);
    const snapshot = (
      previousJob?.payload as unknown as PrintTicketDocument | undefined
    )?.items.find((i) => i.id === itemId);
    document.items = snapshot
      ? [snapshot]
      : this.buildDocument(order, 'CUSTOMER')
          .items.filter((i) => i.id === itemId)
          .map((i) => ({
            ...i,
            unitPrice: undefined,
            totalPrice: undefined,
            modifiers: i.modifiers.map((m) => ({
              name: m.name,
              quantity: m.quantity,
            })),
          }));
    document.dispatch = {
      kind: 'CANCELLATION',
      reason,
      ...(item.preparationJobId
        ? { originalBatchId: item.preparationJobId }
        : {}),
    };
    await this.queueDocument(branchId, orderId, type, document, true, tx);
  }

  private cashierPolicy(values: Map<string, string>) {
    return {
      cashierMode:
        values.get('cashier_ticket_mode') === 'CUSTOMER_AND_BUSINESS'
          ? ('CUSTOMER_AND_BUSINESS' as const)
          : ('BUSINESS_ONLY' as const),
      autoCustomer: values.get('auto_print_customer') !== 'false',
      confirmClose: values.get('confirm_close') === 'true',
      allowReprint: values.get('receipt_reprint_enabled') !== 'false',
    };
  }

  async getCashierPolicy(
    branchId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const settings = await db.setting.findMany({
      where: {
        branchId,
        key: {
          in: [
            'cashier_ticket_mode',
            'auto_print_customer',
            'confirm_close',
            'receipt_reprint_enabled',
          ],
        },
      },
    });
    return this.cashierPolicy(new Map(settings.map((s) => [s.key, s.value])));
  }

  async getPrebill(orderId: string, branchId: string) {
    const order = await this.getOrder(orderId, branchId);
    this.assertPrebillAllowed(order);
    const document = this.buildDocument(order, 'CUSTOMER');
    document.cashierDocument = {
      kind: 'PREBILL',
      receiptId: randomUUID(),
      issuedAt: new Date().toISOString(),
    };
    return document;
  }

  private assertPrebillAllowed(
    order: Awaited<ReturnType<PrintService['getOrder']>>,
  ) {
    const policy = this.cashierPolicy(
      new Map(order.branch.settings.map((s) => [s.key, s.value])),
    );
    if (policy.cashierMode !== 'CUSTOMER_AND_BUSINESS')
      throw new ConflictException(
        'La sucursal usa Solo negocio; precuenta deshabilitada.',
      );
    if (['COMPLETED', 'CANCELLED'].includes(order.status))
      throw new ConflictException(
        'No se imprime precuenta de una cuenta cerrada.',
      );
  }

  async queuePrebill(orderId: string, branchId: string, requestId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND "branchId" = ${branchId} FOR UPDATE`;
      const key = `prebill:${branchId}:${requestId}`;
      const previous = await tx.printJob.findUnique({
        where: { dedupKey: key },
      });
      if (previous) {
        if (previous.orderId !== orderId)
          throw new ConflictException('La solicitud pertenece a otra orden');
        return previous;
      }
      const order = await this.getOrder(orderId, branchId, tx);
      this.assertPrebillAllowed(order);
      const document = this.buildDocument(order, 'CUSTOMER');
      const target = document.config.cashierPrinter;
      if (!target)
        throw new BadRequestException('Configura la impresora de caja');
      const id = randomUUID();
      document.cashierDocument = {
        kind: 'PREBILL',
        receiptId: id,
        issuedAt: new Date().toISOString(),
      };
      return tx.printJob.create({
        data: {
          id,
          dedupKey: key,
          branchId,
          orderId,
          type: 'CUSTOMER',
          printerTarget: target,
          payload: document,
          maxAttempts: 1,
        },
      });
    });
  }

  // Durable sale snapshot/outbox: called inside the final payment transaction.
  // No printer I/O takes place here; missing configuration holds the job for cashier review.
  async captureBusinessReceipt(
    tx: Prisma.TransactionClient,
    orderId: string,
    branchId: string,
  ) {
    const key = `business:${orderId}`;
    const previous = await tx.printJob.findUnique({ where: { dedupKey: key } });
    if (previous) {
      if (previous.branchId !== branchId)
        throw new ConflictException('Sucursal incorrecta');
      return previous;
    }
    const order = await this.getOrder(orderId, branchId, tx);
    const document = this.buildDocument(order, 'CUSTOMER');
    if (
      order.status !== 'COMPLETED' ||
      Math.round(document.totals!.paid * 100) <
        Math.round(document.totals!.total * 100)
    ) {
      throw new ConflictException(
        'El comprobante definitivo requiere una orden liquidada.',
      );
    }
    const policy = this.cashierPolicy(
      new Map(order.branch.settings.map((s) => [s.key, s.value])),
    );
    const id = randomUUID();
    document.cashierDocument = {
      kind: 'BUSINESS',
      receiptId: id,
      issuedAt: (order.completedAt ?? new Date()).toISOString(),
    };
    const target = document.config.cashierPrinter ?? '';
    return tx.printJob.create({
      data: {
        id,
        dedupKey: key,
        branchId,
        orderId,
        type: 'CUSTOMER',
        payload: document,
        printerTarget: target,
        status: policy.autoCustomer && target ? 'PENDING' : 'HELD',
        maxAttempts: 1,
        lastError: !target
          ? 'Configura la impresora de caja para imprimir el comprobante guardado.'
          : null,
      },
    });
  }

  async getBusinessReceipt(orderId: string, branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const job = await this.prisma.printJob.findFirst({
      where: { dedupKey: `business:${orderId}`, orderId, branchId },
    });
    if (!job)
      throw new NotFoundException(
        'No hay comprobante definitivo guardado para esta orden.',
      );
    const latest = await this.prisma.printJob.findFirst({
      where: {
        branchId,
        orderId,
        OR: [
          { dedupKey: `business:${orderId}` },
          { dedupKey: { startsWith: 'business-copy:' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      id: job.id,
      status: latest?.status ?? job.status,
      lastError: latest ? latest.lastError : job.lastError,
      document: job.payload as unknown as PrintTicketDocument,
    };
  }

  async printBusinessReceipt(
    orderId: string,
    branchId: string,
    userId: string,
    requestId: string,
    reason: string,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND "branchId" = ${branchId} FOR UPDATE`;
      const original = await tx.printJob.findFirst({
        where: { dedupKey: `business:${orderId}`, branchId, orderId },
      });
      if (!original)
        throw new NotFoundException('No existe comprobante definitivo');
      const key = `business-copy:${branchId}:${requestId}`;
      const previous = await tx.printJob.findUnique({
        where: { dedupKey: key },
      });
      if (previous) {
        if (previous.orderId !== orderId)
          throw new ConflictException('La solicitud pertenece a otra orden');
        return previous;
      }
      if (['PENDING', 'PROCESSING'].includes(original.status)) return original;
      const inFlight = await tx.printJob.findFirst({
        where: {
          branchId,
          orderId,
          dedupKey: { startsWith: 'business-copy:' },
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });
      if (inFlight) return inFlight;
      const settings = await tx.setting.findMany({ where: { branchId } });
      const values = new Map(settings.map((s) => [s.key, s.value]));
      const target = values.get('printer_cashier');
      if (!target)
        throw new BadRequestException('Configura la impresora de caja');
      const held = original.status === 'HELD';
      if (!held && !this.cashierPolicy(values).allowReprint)
        throw new ConflictException(
          'La reimpresion esta deshabilitada en esta sucursal.',
        );
      const snapshot = original.payload as unknown as PrintTicketDocument;
      const id = randomUUID();
      const document: PrintTicketDocument = {
        ...snapshot,
        cashierDocument: {
          ...snapshot.cashierDocument!,
          reprint: !held,
          sourceJobId: original.id,
        },
      };
      const job = await tx.printJob.create({
        data: {
          id,
          branchId,
          orderId,
          type: 'CUSTOMER',
          dedupKey: key,
          payload: document,
          printerTarget: target,
          maxAttempts: 1,
        },
      });
      // HELD is an archived snapshot; claim it once without sending two jobs to the agent.
      if (held)
        await tx.printJob.update({
          where: { id: original.id },
          data: {
            status: 'CANCELLED',
            lastError: 'Original conservado; impresion solicitada por caja.',
          },
        });
      await tx.auditLog.create({
        data: {
          branchId,
          userId,
          action: held ? 'BUSINESS_RECEIPT_PRINT' : 'BUSINESS_RECEIPT_REPRINT',
          entity: 'PrintJob',
          entityId: original.id,
          metadata: { requestId, reason, jobId: job.id },
        },
      });
      return job;
    });
  }

  private queueDocument(
    branchId: string,
    orderId: string,
    type: PrintJobType,
    document: PrintTicketDocument,
    requireTarget: boolean,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
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

    const id = randomUUID();
    document.dispatch = {
      ...document.dispatch,
      batchId: id,
      sentAt: new Date().toISOString(),
      kind: document.dispatch?.kind ?? 'NEW',
    };
    return db.printJob.create({
      data: {
        id,
        branchId,
        orderId,
        type,
        printerTarget,
        payload: document,
        maxAttempts: type === 'CUSTOMER' ? 8 : 1,
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
    return this.prisma.$transaction(async (tx) => {
      const printedAt = new Date();
      const result = await tx.printJob.updateMany({
        where: {
          id: jobId,
          status: PrintJobStatus.PROCESSING,
          claimedBy: agentId,
        },
        data: {
          status: PrintJobStatus.PRINTED,
          printedAt,
          claimedAt: null,
          claimedBy: null,
          lastError: null,
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Trabajo no reclamado');
      await tx.orderItem.updateMany({
        where: { preparationJobId: jobId, preparationStatus: 'QUEUED' },
        data: { preparationStatus: 'SENT', printedAt },
      });
      return { id: jobId, status: PrintJobStatus.PRINTED };
    });
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
        status: PrintJobStatus.FAILED,
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

  private async getOrder(
    orderId: string,
    branchId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');

    const order = await db.order.findFirst({
      where: { id: orderId, branchId, deletedAt: null },
      include: {
        branch: {
          include: {
            settings: {
              where: { group: { in: ['print', 'ticket', 'general'] } },
            },
          },
        },
        table: { include: { area: true } },
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
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private pendingPreview(
    order: Awaited<ReturnType<PrintService['getOrder']>>,
    type: PrintTicketType,
  ) {
    const document = this.buildDocument(order, type);
    const ids = new Set(
      order.items
        .filter((i) => i.preparationStatus === 'PENDING')
        .map((i) => i.id),
    );
    document.items = document.items.filter((i) => ids.has(i.id));
    return document;
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
      .filter(
        (item) =>
          item.status !== 'CANCELLED' &&
          (!station || item.product.preparationStation === station),
      )
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
          'PLAYCOFFEE',
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
        timezone: order.branch.timezone,
        area: order.table?.area?.name ?? null,
        table: order.table?.number ?? null,
        cashier: this.formatUser(
          order.payments[order.payments.length - 1]?.user ?? null,
        ),
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
