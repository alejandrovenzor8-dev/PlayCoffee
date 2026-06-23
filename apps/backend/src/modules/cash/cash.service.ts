import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashMovementType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CashMovementDto } from './dto/cash-movement.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async open(branchId: string, userId: string, dto: OpenShiftDto) {
    if (!branchId) throw new BadRequestException('branchId is required');

    const active = await this.findOpenShift(branchId);
    if (active) {
      throw new ConflictException('There is already an open cash shift');
    }

    const shift = await this.prisma.shift.create({
      data: {
        branchId,
        userId,
        openingBalance: dto.openingBalance,
        notes: dto.notes,
      },
      include: this.shiftInclude,
    });

    return this.toShiftSummary(shift);
  }

  async getCurrent(branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const shift = await this.findOpenShift(branchId);
    return shift ? this.toShiftSummary(shift) : null;
  }

  async addMovement(branchId: string, userId: string, dto: CashMovementDto) {
    if (!branchId) throw new BadRequestException('branchId is required');
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Movement reason is required');
    }

    const shift = dto.shiftId
      ? await this.findShift(dto.shiftId, branchId)
      : await this.findOpenShift(branchId);

    if (!shift) throw new NotFoundException('Open cash shift not found');
    if (shift.closedAt) {
      throw new BadRequestException('Cannot add movements to a closed shift');
    }

    await this.prisma.cashMovement.create({
      data: {
        shiftId: shift.id,
        branchId,
        userId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason.trim(),
      },
    });

    return this.getDetail(shift.id, branchId);
  }

  async close(branchId: string, userId: string, dto: CloseShiftDto) {
    if (!branchId) throw new BadRequestException('branchId is required');

    const shift = await this.findOpenShift(branchId);
    if (!shift) throw new NotFoundException('Open cash shift not found');
    if (shift.closedAt)
      throw new BadRequestException('Shift is already closed');

    const summary = this.calculate(shift);
    const closed = await this.prisma.shift.update({
      where: { id: shift.id },
      data: {
        closingBalance: dto.closingBalance,
        expectedCash: summary.expectedCash,
        cashDifference: dto.closingBalance - summary.expectedCash,
        totalSales: summary.totalSales,
        totalCash: summary.totalCash,
        totalCard: summary.totalCard,
        totalTransfer: summary.totalTransfer,
        totalIn: summary.totalIn,
        totalOut: summary.totalOut,
        closedAt: new Date(),
        notes: dto.notes ?? shift.notes,
      },
      include: this.shiftInclude,
    });

    return this.toShiftSummary(closed, userId);
  }

  async list(branchId: string, from?: string, to?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');

    const start = from ? new Date(from) : undefined;
    const end = to ? new Date(to) : undefined;
    if (end) end.setHours(23, 59, 59, 999);

    const shifts = await this.prisma.shift.findMany({
      where: {
        branchId,
        ...(start || end
          ? {
              openedAt: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            }
          : {}),
      },
      include: this.shiftInclude,
      orderBy: { openedAt: 'desc' },
      take: 100,
    });

    return shifts.map((shift) => this.toShiftSummary(shift));
  }

  async getDetail(id: string, branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const shift = await this.findShift(id, branchId);
    if (!shift) throw new NotFoundException('Cash shift not found');
    return this.toShiftSummary(shift);
  }

  async findOpenShift(branchId: string) {
    return this.prisma.shift.findFirst({
      where: { branchId, closedAt: null },
      include: this.shiftInclude,
      orderBy: { openedAt: 'desc' },
    });
  }

  private async findShift(id: string, branchId: string) {
    return this.prisma.shift.findFirst({
      where: { id, branchId },
      include: this.shiftInclude,
    });
  }

  private calculate(shift: ShiftWithRelations) {
    const completedPayments = shift.payments.filter(
      (payment) => payment.status === PaymentStatus.COMPLETED,
    );

    const totalByMethod = (method: PaymentMethod) =>
      completedPayments
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const totalCash = totalByMethod(PaymentMethod.CASH);
    const totalCard = totalByMethod(PaymentMethod.CARD);
    const totalTransfer =
      totalByMethod(PaymentMethod.TRANSFER) + totalByMethod(PaymentMethod.QR);
    const totalSales = completedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalIn = shift.movements
      .filter((movement) => movement.type === CashMovementType.IN)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
    const totalOut = shift.movements
      .filter((movement) => movement.type === CashMovementType.OUT)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
    const expectedCash =
      Number(shift.openingBalance) + totalCash + totalIn - totalOut;

    return {
      totalSales,
      totalCash,
      totalCard,
      totalTransfer,
      totalIn,
      totalOut,
      expectedCash,
    };
  }

  private toShiftSummary(shift: ShiftWithRelations, closedByUserId?: string) {
    const summary = this.calculate(shift);
    const closingBalance =
      shift.closingBalance === null ? null : Number(shift.closingBalance);
    const cashDifference =
      shift.cashDifference === null
        ? closingBalance === null
          ? null
          : closingBalance - summary.expectedCash
        : Number(shift.cashDifference);

    return {
      id: shift.id,
      branchId: shift.branchId,
      userId: shift.userId,
      openedBy: shift.user,
      closedByUserId,
      openingBalance: Number(shift.openingBalance),
      closingBalance,
      expectedCash:
        shift.expectedCash === null
          ? summary.expectedCash
          : Number(shift.expectedCash),
      cashDifference,
      totalSales:
        shift.totalSales === null
          ? summary.totalSales
          : Number(shift.totalSales),
      totalCash:
        shift.totalCash === null ? summary.totalCash : Number(shift.totalCash),
      totalCard:
        shift.totalCard === null ? summary.totalCard : Number(shift.totalCard),
      totalTransfer:
        shift.totalTransfer === null
          ? summary.totalTransfer
          : Number(shift.totalTransfer),
      totalIn: shift.totalIn === null ? summary.totalIn : Number(shift.totalIn),
      totalOut:
        shift.totalOut === null ? summary.totalOut : Number(shift.totalOut),
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      notes: shift.notes,
      movements: shift.movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: Number(movement.amount),
        reason: movement.reason,
        userId: movement.userId,
        user: movement.user,
        createdAt: movement.createdAt,
      })),
      payments: shift.payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        method: payment.method,
        amount: Number(payment.amount),
        tipAmount: Number(payment.tipAmount),
        status: payment.status,
        processedAt: payment.processedAt,
      })),
    };
  }

  private readonly shiftInclude = {
    user: {
      select: { id: true, firstName: true, lastName: true, email: true },
    },
    movements: {
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    },
    payments: {
      where: { status: PaymentStatus.COMPLETED },
      orderBy: { createdAt: 'desc' as const },
    },
  };
}

type ShiftWithRelations = NonNullable<
  Awaited<ReturnType<CashService['findOpenShift']>>
>;
