import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesSummary(branchId: string, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: OrderStatus.COMPLETED,
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
        payments: true,
      },
    });

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((s, o) => s + o.items.reduce((i, it) => i + it.quantity, 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by payment method
    const byPaymentMethod: Record<string, number> = {};
    for (const order of orders) {
      for (const payment of order.payments) {
        const method = payment.method as string;
        byPaymentMethod[method] = (byPaymentMethod[method] ?? 0) + Number(payment.amount);
      }
    }

    // Top products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.productId;
        if (!productSales[pid]) {
          productSales[pid] = { name: item.product.name, quantity: 0, revenue: 0 };
        }
        productSales[pid].quantity += item.quantity;
        productSales[pid].revenue += Number(item.totalPrice);
      }
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily revenue breakdown
    const dailyRevenue: Record<string, number> = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] ?? 0) + Number(order.total);
    }

    return {
      totalRevenue,
      totalOrders,
      totalItems,
      avgOrderValue,
      byPaymentMethod,
      topProducts,
      dailyRevenue: Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue })),
    };
  }

  async getKpis(branchId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayOrders, monthOrders, activeTables, activeChildren] = await Promise.all([
      this.prisma.order.aggregate({
        where: { branchId, deletedAt: null, status: OrderStatus.COMPLETED, createdAt: { gte: startOfDay } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { branchId, deletedAt: null, status: OrderStatus.COMPLETED, createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.restaurantTable.count({
        where: { area: { branchId }, status: 'OCCUPIED', deletedAt: null },
      }),
      this.prisma.childAccess.count({
        where: { exitTime: null, type: 'ENTRY' },
      }),
    ]);

    return {
      today: {
        revenue: Number(todayOrders._sum.total ?? 0),
        orders: todayOrders._count,
      },
      month: {
        revenue: Number(monthOrders._sum.total ?? 0),
        orders: monthOrders._count,
      },
      activeTables,
      activeChildren,
    };
  }

  async getSummary(branchId?: string, from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      deletedAt: null,
      status: OrderStatus.COMPLETED,
      createdAt: { gte: start, lte: end },
    };
    if (branchId) where['branchId'] = branchId;

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { include: { category: true } } } },
        payments: true,
      },
    });

    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const orderCount = orders.length;
    const avgTicket = orderCount > 0 ? revenue / orderCount : 0;

    // Sales by day
    const salesMap = new Map<string, { revenue: number; orders: number }>();
    for (const order of orders) {
      const day = order.createdAt.toLocaleDateString('es-MX', { weekday: 'short' });
      const existing = salesMap.get(day) ?? { revenue: 0, orders: 0 };
      salesMap.set(day, { revenue: existing.revenue + Number(order.total), orders: existing.orders + 1 });
    }
    const salesByDay = Array.from(salesMap.entries()).map(([date, v]) => ({ date, ...v }));

    // Sales by category
    const catMap = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const cat = item.product?.category?.name ?? 'Sin categoría';
        catMap.set(cat, (catMap.get(cat) ?? 0) + Number(item.totalPrice));
      }
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Top product
    const productMap = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const name = item.product?.name ?? 'Desconocido';
        productMap.set(name, (productMap.get(name) ?? 0) + item.quantity);
      }
    }
    const topProduct = [...productMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      kpi: { revenue, orders: orderCount, avgTicket, revenueChange: 0, ordersChange: 0, avgTicketChange: 0, topProduct },
      salesByDay,
      byCategory,
    };
  }
}
