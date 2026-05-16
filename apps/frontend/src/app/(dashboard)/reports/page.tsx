"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Package, Loader2, Download,
} from "lucide-react";

interface KPI {
  revenue: number;
  revenueChange: number;
  orders: number;
  ordersChange: number;
  avgTicket: number;
  avgTicketChange: number;
  topProduct: string;
}

interface SalesByDay {
  date: string;
  revenue: number;
  orders: number;
}

interface SalesByCategory {
  category: string;
  amount: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

const mockKPI: KPI = {
  revenue: 42580, revenueChange: 12.4,
  orders: 312, ordersChange: 8.1,
  avgTicket: 136.5, avgTicketChange: 3.9,
  topProduct: "Cappuccino",
};

const mockSalesByDay: SalesByDay[] = [
  { date: "Lun", revenue: 5200, orders: 38 },
  { date: "Mar", revenue: 6100, orders: 45 },
  { date: "Mié", revenue: 5800, orders: 42 },
  { date: "Jue", revenue: 7200, orders: 53 },
  { date: "Vie", revenue: 8400, orders: 61 },
  { date: "Sáb", revenue: 9800, orders: 71 },
  { date: "Dom", revenue: 8580, orders: 62 },
];

const mockByCategory: SalesByCategory[] = [
  { category: "Bebidas Calientes", amount: 18200 },
  { category: "Bebidas Frías", amount: 9400 },
  { category: "Alimentos", amount: 10300 },
  { category: "Postres", amount: 4680 },
];

function KPICard({
  title, value, change, icon: Icon, format = "number",
}: {
  title: string;
  value: number;
  change: number;
  icon: typeof DollarSign;
  format?: "currency" | "number";
}) {
  const isPositive = change >= 0;
  const display = format === "currency" ? formatCurrency(value) : value.toLocaleString("es-MX");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{display}</p>
            <div className={cn("flex items-center gap-1 mt-1 text-sm font-medium", isPositive ? "text-green-600" : "text-red-600")}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{Math.abs(change).toFixed(1)}% vs semana anterior</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [byCategory, setByCategory] = useState<SalesByCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const loadReport = () => {
    setIsLoading(true);
    reportsApi.getSummary({ from: dateFrom, to: dateTo })
      .then((data) => {
        setKpi(data.kpi ?? mockKPI);
        setSalesByDay(data.salesByDay ?? mockSalesByDay);
        setByCategory(data.byCategory ?? mockByCategory);
      })
      .catch(() => {
        setKpi(mockKPI);
        setSalesByDay(mockSalesByDay);
        setByCategory(mockByCategory);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadReport(); }, []);

  const displayKPI = kpi ?? mockKPI;
  const displaySales = salesByDay.length > 0 ? salesByDay : mockSalesByDay;
  const displayCategories = byCategory.length > 0 ? byCategory : mockByCategory;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Análisis de ventas y desempeño"
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        }
      />

      {/* Date range */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={loadReport} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aplicar
          </Button>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Ventas Totales" value={displayKPI.revenue} change={displayKPI.revenueChange} icon={DollarSign} format="currency" />
        <KPICard title="Órdenes" value={displayKPI.orders} change={displayKPI.ordersChange} icon={ShoppingBag} />
        <KPICard title="Ticket Promedio" value={displayKPI.avgTicket} change={displayKPI.avgTicketChange} icon={TrendingUp} format="currency" />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Producto estrella</p>
            <p className="text-2xl font-bold mt-1">{displayKPI.topProduct}</p>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Más vendido del período</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue by day */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Ventas por Día</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={displaySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Ventas"]} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By category (pie) */}
        <Card>
          <CardHeader><CardTitle>Por Categoría</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={displayCategories}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="amount"
                  nameKey="category"
                >
                  {displayCategories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
                <Legend iconSize={10} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Orders per day bar */}
      <Card>
        <CardHeader><CardTitle>Órdenes por Día</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={displaySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [Number(v ?? 0), "Órdenes"]} />
              <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
