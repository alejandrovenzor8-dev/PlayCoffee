"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  TrendingUp, ShoppingCart, Table2, Baby, DollarSign, Loader2,
} from "lucide-react";

interface Kpis {
  today: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  activeTables: number;
  activeChildren: number;
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

function KpiCard({
  title, value, icon: Icon, color,
}: {
  title: string;
  value: string;
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
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [byCategory, setByCategory] = useState<SalesByCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const branchId = getActiveBranchId(user);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);

    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      reportsApi.getKpis(branchId),
      reportsApi.getSummary({
        branchId,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      }),
    ])
      .then(([nextKpis, summary]) => {
        setKpis(nextKpis);
        setSalesByDay(summary.salesByDay ?? []);
        setByCategory(summary.byCategory ?? []);
      })
      .catch(() => {
        setKpis(null);
        setSalesByDay([]);
        setByCategory([]);
        setLoadError("No se pudieron cargar los reportes. Verifica que la API este disponible.");
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Ejecutivo" description="Resumen operativo" />
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {loadError}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Ejecutivo"
        description={`Resumen operativo - ${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ventas Hoy"
          value={formatCurrency(kpis?.today.revenue ?? 0)}
          icon={DollarSign}
          color="bg-blue-600"
        />
        <KpiCard
          title="Ordenes Hoy"
          value={String(kpis?.today.orders ?? 0)}
          icon={ShoppingCart}
          color="bg-violet-600"
        />
        <KpiCard
          title="Mesas Ocupadas"
          value={String(kpis?.activeTables ?? 0)}
          icon={Table2}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Ninos en Area"
          value={String(kpis?.activeChildren ?? 0)}
          icon={Baby}
          color="bg-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Ventas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesByDay.length === 0 ? (
              <EmptyChart message="Sin ventas completadas en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesByDay}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
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
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Ventas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <EmptyChart message="Sin categorias vendidas en el periodo." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={92} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Ingresos"]} />
                  <Bar dataKey="amount" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Ventas del Mes</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(kpis?.month.revenue ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ordenes del Mes</p>
              <p className="mt-1 text-2xl font-bold">{kpis?.month.orders ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ticket Promedio</p>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency((kpis?.month.revenue ?? 0) / (kpis?.month.orders || 1))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
