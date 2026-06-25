import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ChildAccessStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  TableStatus,
} from '@prisma/client';

type Range = { start: Date; end: Date };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const [
      payments,
      paidOrderIds,
      activeChildren,
      completedChildren,
      reservations,
      lowStock,
    ] = await Promise.all([
      this.getCompletedPayments(branchId, range),
      this.getPaidOrderIds(branchId, range),
      this.prisma.childAccess.count({
        where: {
          branchId,
          exitTime: null,
          status: { not: ChildAccessStatus.COMPLETED },
        },
      }),
      this.prisma.childAccess.count({
        where: {
          branchId,
          status: ChildAccessStatus.COMPLETED,
          exitTime: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.reservation.groupBy({
        by: ['status'],
        where: {
          branchId,
          deletedAt: null,
          reservedAt: { gte: range.start, lte: range.end },
        },
        _count: true,
      }),
      this.getLowStock(branchId),
    ]);

    const byMethod = this.sumPaymentsByMethod(payments);
    const totalSales = this.roundMoney(
      payments.reduce((sum, p) => sum + Number(p.amount), 0),
    );
    const ticketCount = paidOrderIds.size;

    return {
      totalSales,
      paidOrders: ticketCount,
      averageTicket:
        ticketCount > 0 ? this.roundMoney(totalSales / ticketCount) : 0,
      cash: byMethod.CASH ?? 0,
      card: byMethod.CARD ?? 0,
      transfer: byMethod.TRANSFER ?? 0,
      activeChildren,
      completedChildAccess: completedChildren,
      pendingReservations:
        reservations.find((r) => r.status === ReservationStatus.PENDING)
          ?._count ?? 0,
      confirmedReservations:
        reservations.find((r) => r.status === ReservationStatus.CONFIRMED)
          ?._count ?? 0,
      lowStockProducts: lowStock.length,
    };
  }

  async salesByDay(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const payments = await this.getCompletedPayments(branchId, range);
    const map = new Map<
      string,
      { date: string; revenue: number; orders: Set<string> }
    >();
    for (const payment of payments) {
      const date = (payment.processedAt ?? payment.createdAt)
        .toISOString()
        .slice(0, 10);
      const current = map.get(date) ?? {
        date,
        revenue: 0,
        orders: new Set<string>(),
      };
      current.revenue += Number(payment.amount);
      current.orders.add(payment.orderId);
      map.set(date, current);
    }
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        revenue: this.roundMoney(item.revenue),
        orders: item.orders.size,
      }));
  }

  async salesByCategory(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const paidOrderIds = await this.getPaidOrderIds(branchId, range);
    if (paidOrderIds.size === 0) return [];

    const items = await this.prisma.orderItem.findMany({
      where: { orderId: { in: [...paidOrderIds] } },
      include: { product: { include: { category: true } } },
    });
    const map = new Map<string, number>();
    for (const item of items) {
      const category = item.product.category?.name ?? 'Sin categoria';
      map.set(category, (map.get(category) ?? 0) + Number(item.totalPrice));
    }
    return [...map.entries()]
      .map(([category, amount]) => ({
        category,
        amount: this.roundMoney(amount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  async paymentMethods(branchId?: string, start?: string, end?: string) {
    const payments = await this.getCompletedPayments(
      branchId,
      this.getRange(start, end),
    );
    const map = this.sumPaymentsByMethod(payments);
    return Object.entries(map).map(([method, amount]) => ({ method, amount }));
  }

  async peakHours(branchId?: string, start?: string, end?: string) {
    const payments = await this.getCompletedPayments(
      branchId,
      this.getRange(start, end),
    );
    const map = new Map<
      number,
      { hour: number; total: number; orders: Set<string> }
    >();
    for (const payment of payments) {
      const hour = (payment.processedAt ?? payment.createdAt).getHours();
      const current = map.get(hour) ?? {
        hour,
        total: 0,
        orders: new Set<string>(),
      };
      current.total += Number(payment.amount);
      current.orders.add(payment.orderId);
      map.set(hour, current);
    }
    return Array.from({ length: 24 }, (_, hour) => {
      const item = map.get(hour);
      return {
        hour,
        total: this.roundMoney(item?.total ?? 0),
        orders: item?.orders.size ?? 0,
      };
    });
  }

  async waiterSales(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const paidOrderIds = await this.getPaidOrderIds(branchId, range);
    if (paidOrderIds.size === 0) return [];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: [...paidOrderIds] }, branchId, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        payments: true,
      },
    });
    const map = new Map<
      string,
      { userId: string; name: string; total: number; orders: number }
    >();
    for (const order of orders) {
      const paid = order.payments
        .filter((payment) => payment.status === PaymentStatus.COMPLETED)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const current = map.get(order.userId) ?? {
        userId: order.userId,
        name: `${order.user.firstName} ${order.user.lastName}`,
        total: 0,
        orders: 0,
      };
      current.total += paid;
      current.orders += 1;
      map.set(order.userId, current);
    }
    return [...map.values()]
      .map((item) => ({ ...item, total: this.roundMoney(item.total) }))
      .sort((a, b) => b.total - a.total);
  }

  async childAccess(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const [active, completed, overtime, completedRecords] = await Promise.all([
      this.prisma.childAccess.count({
        where: {
          branchId,
          exitTime: null,
          status: { not: ChildAccessStatus.COMPLETED },
        },
      }),
      this.prisma.childAccess.count({
        where: {
          branchId,
          status: ChildAccessStatus.COMPLETED,
          exitTime: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.childAccess.count({
        where: {
          branchId,
          OR: [
            { status: ChildAccessStatus.OVERTIME },
            { extraAmount: { gt: 0 } },
          ],
          createdAt: { gte: range.start, lte: range.end },
        },
      }),
      this.prisma.childAccess.findMany({
        where: {
          branchId,
          status: ChildAccessStatus.COMPLETED,
          exitTime: { gte: range.start, lte: range.end },
        },
        select: { totalAmount: true, extraAmount: true },
      }),
    ]);
    return {
      active,
      completed,
      overtime,
      revenue: this.roundMoney(
        completedRecords.reduce(
          (sum, item) => sum + Number(item.totalAmount),
          0,
        ),
      ),
      extras: this.roundMoney(
        completedRecords.reduce(
          (sum, item) => sum + Number(item.extraAmount),
          0,
        ),
      ),
    };
  }

  async reservations(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const records = await this.prisma.reservation.findMany({
      where: {
        branchId,
        deletedAt: null,
        reservedAt: { gte: range.start, lte: range.end },
      },
      select: { status: true, depositAmount: true, totalAmount: true },
    });
    const count = (status: ReservationStatus) =>
      records.filter((r) => r.status === status).length;
    const deposits = records.reduce(
      (sum, r) => sum + Number(r.depositAmount),
      0,
    );
    const pendingBalance = records.reduce(
      (sum, r) =>
        sum + Math.max(0, Number(r.totalAmount) - Number(r.depositAmount)),
      0,
    );
    return {
      total: records.length,
      pending: count(ReservationStatus.PENDING),
      confirmed: count(ReservationStatus.CONFIRMED),
      cancelled: count(ReservationStatus.CANCELLED),
      completed: count(ReservationStatus.COMPLETED),
      deposits: this.roundMoney(deposits),
      pendingBalance: this.roundMoney(pendingBalance),
    };
  }

  async inventoryLowStock(branchId?: string) {
    return this.getLowStock(branchId);
  }

  async cashShifts(branchId?: string, start?: string, end?: string) {
    const range = this.getRange(start, end);
    const shifts = await this.prisma.shift.findMany({
      where: { branchId, closedAt: { gte: range.start, lte: range.end } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { closedAt: 'desc' },
    });
    return shifts.map((shift) => ({
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      cashier: `${shift.user.firstName} ${shift.user.lastName}`,
      openingBalance: Number(shift.openingBalance),
      closingBalance: Number(shift.closingBalance ?? 0),
      expectedCash: Number(shift.expectedCash ?? 0),
      cashDifference: Number(shift.cashDifference ?? 0),
      totalSales: Number(shift.totalSales ?? 0),
      totalCash: Number(shift.totalCash ?? 0),
      totalCard: Number(shift.totalCard ?? 0),
      totalTransfer: Number(shift.totalTransfer ?? 0),
    }));
  }

  async getKpis(branchId: string) {
    const now = new Date();
    const today = this.toDateParam(now);
    const monthStart = this.toDateParam(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const [todaySummary, monthSummary, activeTables] = await Promise.all([
      this.getSummary(branchId, today, today),
      this.getSummary(branchId, monthStart, today),
      this.prisma.restaurantTable.count({
        where: {
          deletedAt: null,
          isActive: true,
          status: TableStatus.OCCUPIED,
          area: { branchId, deletedAt: null },
        },
      }),
    ]);

    return {
      today: {
        revenue: todaySummary.totalSales,
        orders: todaySummary.paidOrders,
      },
      month: {
        revenue: monthSummary.totalSales,
        orders: monthSummary.paidOrders,
      },
      activeTables,
      activeChildren: todaySummary.activeChildren,
    };
  }

  async getSalesSummary(branchId: string, from: string, to: string) {
    const [summary, salesByDay, byCategory, paymentMethods] = await Promise.all(
      [
        this.getSummary(branchId, from, to),
        this.salesByDay(branchId, from, to),
        this.salesByCategory(branchId, from, to),
        this.paymentMethods(branchId, from, to),
      ],
    );
    return { summary, salesByDay, byCategory, paymentMethods };
  }

  private getRange(start?: string, end?: string): Range {
    const rangeStart = start
      ? new Date(start)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rangeEnd = end ? new Date(end) : new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    if (rangeEnd < rangeStart)
      throw new BadRequestException('Invalid date range');
    return { start: rangeStart, end: rangeEnd };
  }

  private toDateParam(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private async getCompletedPayments(
    branchId: string | undefined,
    range: Range,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: { gte: range.start, lte: range.end },
        order: {
          branchId,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
        },
      },
      select: {
        id: true,
        orderId: true,
        method: true,
        amount: true,
        createdAt: true,
        processedAt: true,
      },
    });
  }

  private async getPaidOrderIds(branchId: string | undefined, range: Range) {
    const payments = await this.getCompletedPayments(branchId, range);
    return new Set(payments.map((payment) => payment.orderId));
  }

  private sumPaymentsByMethod(
    payments: Array<{ method: PaymentMethod; amount: unknown }>,
  ) {
    const result: Partial<Record<PaymentMethod, number>> = {};
    for (const payment of payments) {
      result[payment.method] = this.roundMoney(
        (result[payment.method] ?? 0) + Number(payment.amount),
      );
    }
    return result;
  }

  private async getLowStock(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        branchId,
        deletedAt: null,
        isActive: true,
        currentStock: { lte: this.prisma.inventoryItem.fields.minStock },
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { currentStock: 'asc' },
      take: 50,
    });
    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product?.name ?? item.name,
      sku: item.product?.sku ?? null,
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
      unit: item.unit,
    }));
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
