"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingCart, Table2, Baby, DollarSign, ArrowUpRight,
} from "lucide-react";

interface Kpis {
  today: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  activeTables: number;
  activeChildren: number;
}

const mockSalesData = [
  { date: "Lun", revenue: 4200 },
  { date: "Mar", revenue: 3800 },
  { date: "Mié", revenue: 5100 },
  { date: "Jue", revenue: 4700 },
  { date: "Vie", revenue: 7200 },
  { date: "Sáb", revenue: 9800 },
  { date: "Dom", revenue: 8400 },
];

const mockProducts = [
  { name: "Cappuccino", quantity: 142, revenue: 4544 },
  { name: "Latte", quantity: 118, revenue: 4130 },
  { name: "Americano", quantity: 96, revenue: 2400 },
  { name: "Waffle", quantity: 74, revenue: 3700 },
  { name: "Smoothie", quantity: 62, revenue: 3100 },
];

function KpiCard({
  title, value, subtitle, icon: Icon, color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" />
                {subtitle}
              </p>
            )}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    // In a real app, use actual branchId from auth store
    reportsApi.getKpis("demo-branch").catch(() => {
      // Use mock data when API is unavailable
      setKpis({
        today: { revenue: 8750, orders: 43 },
        month: { revenue: 187450, orders: 892 },
        activeTables: 7,
        activeChildren: 12,
      });
    });
    // Set mock data immediately for demo
    setKpis({
      today: { revenue: 8750, orders: 43 },
      month: { revenue: 187450, orders: 892 },
      activeTables: 7,
      activeChildren: 12,
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Ejecutivo"
        description={`Resumen operativo — ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ventas Hoy"
          value={formatCurrency(kpis?.today.revenue ?? 0)}
          subtitle="+12.5% vs ayer"
          icon={DollarSign}
          color="bg-blue-600"
        />
        <KpiCard
          title="Órdenes Hoy"
          value={String(kpis?.today.orders ?? 0)}
          subtitle="+8 vs ayer"
          icon={ShoppingCart}
          color="bg-violet-600"
        />
        <KpiCard
          title="Mesas Activas"
          value={String(kpis?.activeTables ?? 0)}
          subtitle="de 24 disponibles"
          icon={Table2}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Niños en Área"
          value={String(kpis?.activeChildren ?? 0)}
          subtitle="2 por vencer tiempo"
          icon={Baby}
          color="bg-amber-500"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Ventas Semanales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mockSalesData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Ventas"]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mockProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Ingresos"]} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Month summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Ventas del Mes</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(kpis?.month.revenue ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Órdenes del Mes</p>
              <p className="text-2xl font-bold mt-1">{kpis?.month.orders ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ticket Promedio</p>
              <p className="text-2xl font-bold mt-1">
                {kpis
                  ? formatCurrency(kpis.month.revenue / (kpis.month.orders || 1))
                  : "$0"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
