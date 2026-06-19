"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DollarSign, Download, Loader2, Package, ShoppingBag, TrendingUp } from "lucide-react";

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

function KPICard({
  title, value, icon: Icon, format = "number",
}: {
  title: string;
  value: number;
  icon: typeof DollarSign;
  format?: "currency" | "number";
}) {
  const display = format === "currency" ? formatCurrency(value) : value.toLocaleString("es-MX");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{display}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [byCategory, setByCategory] = useState<SalesByCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const loadReport = () => {
    setIsLoading(true);
    setLoadError(null);
    reportsApi.getSummary({ branchId, from: dateFrom, to: dateTo })
      .then((data) => {
        setKpi(data.kpi ?? null);
        setSalesByDay(data.salesByDay ?? []);
        setByCategory(data.byCategory ?? []);
      })
      .catch(() => {
        setKpi(null);
        setSalesByDay([]);
        setByCategory([]);
        setLoadError("No se pudieron cargar los reportes. Verifica que la API este disponible.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadReport(); }, [branchId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Analisis de ventas y desempeno"
        actions={
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" />
          </div>
          <Button onClick={loadReport} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aplicar
          </Button>
        </CardContent>
      </Card>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Ventas Totales" value={kpi?.revenue ?? 0} icon={DollarSign} format="currency" />
            <KPICard title="Ordenes" value={kpi?.orders ?? 0} icon={ShoppingBag} />
            <KPICard title="Ticket Promedio" value={kpi?.avgTicket ?? 0} icon={TrendingUp} format="currency" />
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground">Producto estrella</p>
                <p className="mt-1 text-2xl font-bold">{kpi?.topProduct ?? "-"}</p>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Mas vendido del periodo</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Ventas por Dia</CardTitle></CardHeader>
              <CardContent>
                {salesByDay.length === 0 ? (
                  <EmptyChart message="Sin ventas completadas en el periodo." />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={salesByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Ventas"]} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por Categoria</CardTitle></CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <EmptyChart message="Sin categorias vendidas en el periodo." />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={byCategory} cx="50%" cy="45%" innerRadius={55} outerRadius={85} dataKey="amount" nameKey="category">
                        {byCategory.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
                      <Legend iconSize={10} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Ordenes por Dia</CardTitle></CardHeader>
            <CardContent>
              {salesByDay.length === 0 ? (
                <EmptyChart message="Sin ordenes completadas en el periodo." />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [Number(v ?? 0), "Ordenes"]} />
                    <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
