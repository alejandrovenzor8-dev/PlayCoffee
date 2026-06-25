import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChildAccessDto } from './dto/create-child-access.dto';
import {
  ChildAccess,
  ChildAccessMode,
  ChildAccessStatus,
  ChildAccessType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type ChildAccessWithOrder = ChildAccess & {
  order?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: Prisma.Decimal;
  } | null;
};

type RuntimeChildAccess = ChildAccessWithOrder & {
  runtimeStatus: ChildAccessStatus;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  extraHours: number;
  calculatedExtraAmount: number;
  calculatedTotalAmount: number;
};

@Injectable()
export class ChildAccessService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private realtime: RealtimeGateway,
  ) {}

  async findActive(branchId?: string): Promise<RuntimeChildAccess[]> {
    if (!branchId) throw new BadRequestException('branchId is required');
    const records: ChildAccessWithOrder[] =
      await this.prisma.childAccess.findMany({
        where: {
          exitTime: null,
          type: ChildAccessType.ENTRY,
          status: { not: ChildAccessStatus.COMPLETED },
          ...(branchId ? { branchId } : {}),
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, status: true, total: true },
          },
        },
        orderBy: { entryTime: 'asc' },
      });
    return records.map((record) => this.withRuntimeSummary(record));
  }

  async findAll(branchId?: string): Promise<RuntimeChildAccess[]> {
    if (!branchId) throw new BadRequestException('branchId is required');
    const records: ChildAccessWithOrder[] =
      await this.prisma.childAccess.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, status: true, total: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    return records.map((record) => this.withRuntimeSummary(record));
  }

  async register(
    dto: CreateChildAccessDto & { branchId: string },
    userId?: string,
  ) {
    const accessMode = dto.accessMode ?? ChildAccessMode.HOURLY;
    const warningMinutes = await this.getNumberSetting(
      dto.branchId,
      'child_warning_minutes',
      10,
    );
    const graceMinutes = await this.getNumberSetting(
      dto.branchId,
      'child_grace_minutes',
      15,
    );
    const defaultHourlyRate = await this.getNumberSetting(
      dto.branchId,
      'child_hourly_rate',
      0,
    );
    const contractedMinutes = dto.contractedMinutes ?? dto.maxDuration;
    if (accessMode === ChildAccessMode.HOURLY && !contractedMinutes) {
      throw new BadRequestException('contractedMinutes is required for HOURLY');
    }

    const hourlyRate = dto.hourlyRate ?? defaultHourlyRate;
    const baseAmount =
      accessMode === ChildAccessMode.FREE
        ? (dto.freePrice ?? 0)
        : Math.ceil((contractedMinutes ?? 0) / 60) * hourlyRate;
    const accessCode = await this.generateAccessCode();
    const record = await this.prisma.$transaction(async (tx) => {
      const order = await this.resolveChargeOrder(
        tx,
        dto.branchId,
        dto.orderId,
        userId,
      );
      const productSettingKey =
        accessMode === ChildAccessMode.FREE
          ? 'child_free_product_id'
          : 'child_hourly_product_id';
      const productLabel =
        accessMode === ChildAccessMode.FREE
          ? 'Acceso infantil libre'
          : 'Acceso infantil por hora';
      const product = await this.getConfiguredProduct(
        tx,
        dto.branchId,
        productSettingKey,
        productLabel,
      );
      const baseOrderItem = await this.addOrderItem(
        tx,
        order.id,
        product.id,
        1,
        baseAmount,
        `${productLabel}: ${dto.childName}`,
      );
      await this.recalculateOrderTotals(tx, order.id);

      return tx.childAccess.create({
        data: {
          ...dto,
          orderId: order.id,
          baseOrderItemId: baseOrderItem.id,
          guardianPhone: dto.guardianPhone ?? '',
          accessMode,
          accessCode,
          contractedMinutes,
          maxDuration: contractedMinutes,
          warningMinutes,
          graceMinutes,
          hourlyRate,
          freePrice: dto.freePrice,
          baseAmount,
          totalAmount: baseAmount,
          status: ChildAccessStatus.ACTIVE,
          type: ChildAccessType.ENTRY,
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, status: true, total: true },
          },
        },
      });
    });

    await this.audit.record({
      branchId: record.branchId,
      userId,
      action: 'CHILD_CHECKIN',
      entity: 'ChildAccess',
      entityId: record.id,
      metadata: {
        childName: record.childName,
        guardianName: record.guardianName,
      },
    });

    const summary = this.withRuntimeSummary(record);
    this.realtime.emitChildAccessEvent(
      record.branchId,
      'child_access.created',
      {
        id: record.id,
        orderId: record.orderId,
        status: summary.runtimeStatus,
      },
    );
    return summary;
  }

  async checkout(
    id: string,
    validation: {
      accessCode?: string;
      guardianName?: string;
      guardianPhone?: string;
    },
    branchId?: string,
    userId?: string,
  ) {
    const record = await this.prisma.childAccess.findFirst({
      where: {
        id,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, total: true },
        },
      },
    });
    if (!record) throw new NotFoundException('Child access record not found');
    if (record.status === ChildAccessStatus.COMPLETED || record.exitTime) {
      throw new BadRequestException('Child access is already completed');
    }
    if (!this.isValidCheckout(record, validation)) {
      throw new BadRequestException(
        'Access code or guardian validation is required',
      );
    }
    const summary = this.calculateSummary(record, new Date());
    const updatedRecord = await this.prisma.$transaction(async (tx) => {
      let extraOrderItemId = record.extraOrderItemId;
      if (summary.extraAmount > 0 && !extraOrderItemId) {
        if (!record.orderId) {
          throw new BadRequestException(
            'Child access is not associated with an order',
          );
        }
        await this.validateChargeOrder(tx, record.orderId, record.branchId);
        const product = await this.getConfiguredProduct(
          tx,
          record.branchId,
          'child_extra_hour_product_id',
          'Hora extra infantil',
        );
        const extraOrderItem = await this.addOrderItem(
          tx,
          record.orderId,
          product.id,
          summary.extraHours,
          Number(record.hourlyRate ?? 0),
          `Hora extra infantil: ${record.childName}`,
        );
        extraOrderItemId = extraOrderItem.id;
        await this.recalculateOrderTotals(tx, record.orderId);
      }

      return tx.childAccess.update({
        where: { id },
        data: {
          exitTime: new Date(),
          type: ChildAccessType.EXIT,
          status: ChildAccessStatus.COMPLETED,
          extraAmount: summary.extraAmount,
          totalAmount: summary.totalAmount,
          extraOrderItemId,
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, status: true, total: true },
          },
        },
      });
    });

    await this.audit.record({
      branchId: updatedRecord.branchId,
      userId,
      action: 'CHILD_CHECKOUT',
      entity: 'ChildAccess',
      entityId: updatedRecord.id,
      metadata: {
        childName: updatedRecord.childName,
        guardianName: updatedRecord.guardianName,
      },
    });

    const access = this.withRuntimeSummary(updatedRecord);
    this.realtime.emitChildAccessEvent(
      updatedRecord.branchId,
      'child_access.updated',
      { id: updatedRecord.id, status: access.runtimeStatus },
    );
    this.realtime.emitChildAccessEvent(
      updatedRecord.branchId,
      'child_access.completed',
      {
        id: updatedRecord.id,
        orderId: updatedRecord.orderId,
        status: access.runtimeStatus,
        totalAmount: Number(updatedRecord.totalAmount),
        extraAmount: Number(updatedRecord.extraAmount),
      },
    );
    this.realtime.emitChildAccessEvent(
      updatedRecord.branchId,
      'child_access.status.changed',
      { id: updatedRecord.id, status: access.runtimeStatus },
    );

    return {
      access,
      chargeSummary: {
        baseAmount: Number(updatedRecord.baseAmount),
        extraAmount: summary.extraAmount,
        totalAmount: summary.totalAmount,
        shouldChargeExtra: summary.extraAmount > 0,
        extraAddedToOrder: summary.extraAmount > 0,
      },
    };
  }

  async getOverstaying(branchId?: string) {
    const now = new Date();
    const records = await this.findActive(branchId);
    return records.filter((r) => {
      if (!r.contractedMinutes) return false;
      const elapsed = (now.getTime() - r.entryTime.getTime()) / 60000;
      return elapsed > r.contractedMinutes + r.graceMinutes;
    });
  }

  private calculateSummary(
    record: {
      accessMode: ChildAccessMode;
      entryTime: Date;
      contractedMinutes: number | null;
      warningMinutes: number;
      graceMinutes: number;
      hourlyRate: unknown;
      baseAmount: unknown;
      exitTime?: Date | null;
    },
    at = new Date(),
  ) {
    const elapsedMinutes = Math.max(
      0,
      Math.floor((at.getTime() - record.entryTime.getTime()) / 60000),
    );
    const contractedMinutes = record.contractedMinutes ?? 0;
    const remainingMinutes =
      record.accessMode === ChildAccessMode.HOURLY
        ? Math.max(0, contractedMinutes - elapsedMinutes)
        : null;

    let status: ChildAccessStatus = ChildAccessStatus.ACTIVE;
    let extraHours = 0;
    if (record.exitTime) {
      status = ChildAccessStatus.COMPLETED;
    } else if (record.accessMode === ChildAccessMode.HOURLY) {
      if (elapsedMinutes >= contractedMinutes + record.graceMinutes + 1) {
        status = ChildAccessStatus.OVERTIME;
        extraHours = Math.ceil(
          (elapsedMinutes - contractedMinutes - record.graceMinutes) / 60,
        );
      } else if (elapsedMinutes > contractedMinutes) {
        status = ChildAccessStatus.GRACE;
      } else if (
        remainingMinutes !== null &&
        remainingMinutes <= record.warningMinutes
      ) {
        status = ChildAccessStatus.WARNING;
      }
    }

    const hourlyRate = Number(record.hourlyRate ?? 0);
    const baseAmount = Number(record.baseAmount ?? 0);
    const extraAmount = extraHours * hourlyRate;
    return {
      elapsedMinutes,
      remainingMinutes,
      status,
      extraHours,
      extraAmount,
      totalAmount: baseAmount + extraAmount,
    };
  }

  private withRuntimeSummary(record: ChildAccessWithOrder): RuntimeChildAccess {
    const summary = this.calculateSummary(record);
    return {
      ...record,
      runtimeStatus: summary.status,
      elapsedMinutes: summary.elapsedMinutes,
      remainingMinutes: summary.remainingMinutes,
      extraHours: summary.extraHours,
      calculatedExtraAmount: summary.extraAmount,
      calculatedTotalAmount: summary.totalAmount,
    };
  }

  private isValidCheckout(
    record: { accessCode: string; guardianName: string; guardianPhone: string },
    validation: {
      accessCode?: string;
      guardianName?: string;
      guardianPhone?: string;
    },
  ) {
    const codeMatches =
      validation.accessCode?.trim().toUpperCase() === record.accessCode;
    const guardianMatches =
      validation.guardianName?.trim().toLowerCase() ===
        record.guardianName.trim().toLowerCase() ||
      (!!validation.guardianPhone &&
        validation.guardianPhone.replace(/\D/g, '') ===
          record.guardianPhone.replace(/\D/g, ''));
    return codeMatches || guardianMatches;
  }

  private async generateAccessCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const existing = await this.prisma.childAccess.findFirst({
        where: { accessCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not generate unique access code');
  }

  private async getNumberSetting(
    branchId: string,
    key: string,
    fallback: number,
  ) {
    const setting = await this.prisma.setting.findFirst({
      where: { branchId, key },
      select: { value: true },
    });
    const value = Number(setting?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private async resolveChargeOrder(
    tx: Prisma.TransactionClient,
    branchId: string,
    orderId: string | undefined,
    userId?: string,
  ) {
    if (orderId) return this.validateChargeOrder(tx, orderId, branchId);
    if (!userId) throw new BadRequestException('userId is required');

    return tx.order.create({
      data: {
        branchId,
        userId,
        orderNumber: `PC-${Date.now().toString(36).toUpperCase()}`,
        status: OrderStatus.PENDING,
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: 0,
        isDelivery: false,
        isTakeaway: true,
        notes: 'Control infantil',
      },
      select: { id: true, branchId: true, status: true },
    });
  }

  private async validateChargeOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    branchId: string,
  ) {
    const order = await tx.order.findFirst({
      where: { id: orderId, branchId, deletedAt: null },
      select: { id: true, branchId: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found for this branch');
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Child access charges cannot be added to paid or cancelled orders',
      );
    }
    return order;
  }

  private async getConfiguredProduct(
    tx: Prisma.TransactionClient,
    branchId: string,
    settingKey: string,
    label: string,
  ) {
    const setting = await tx.setting.findFirst({
      where: { branchId, key: settingKey },
      select: { value: true },
    });
    const productId = setting?.value?.trim();
    if (!productId) {
      throw new BadRequestException(
        `Configure ${settingKey} with the productId for ${label}`,
      );
    }
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!product) {
      throw new BadRequestException(
        `Configured product for ${label} was not found or is inactive`,
      );
    }
    return product;
  }

  private async addOrderItem(
    tx: Prisma.TransactionClient,
    orderId: string,
    productId: string,
    quantity: number,
    unitPrice: number,
    notes: string,
  ) {
    if (quantity <= 0 || unitPrice < 0) {
      throw new BadRequestException('Invalid child access charge amount');
    }
    return tx.orderItem.create({
      data: {
        orderId,
        productId,
        quantity,
        unitPrice,
        totalPrice: this.roundMoney(quantity * unitPrice),
        notes,
        status: OrderStatus.PENDING,
      },
      select: { id: true },
    });
  }

  private async recalculateOrderTotals(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const totals = await tx.orderItem.aggregate({
      where: { orderId },
      _sum: { totalPrice: true },
    });
    const subtotal = this.roundMoney(Number(totals._sum.totalPrice ?? 0));
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { discountAmount: true, taxAmount: true, tipAmount: true },
    });
    const total = this.roundMoney(
      subtotal +
        Number(order?.taxAmount ?? 0) +
        Number(order?.tipAmount ?? 0) -
        Number(order?.discountAmount ?? 0),
    );
    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, total },
    });
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
