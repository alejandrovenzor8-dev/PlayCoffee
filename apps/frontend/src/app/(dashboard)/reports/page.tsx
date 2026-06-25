"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Baby,
  DollarSign,
  Download,
  Loader2,
  Package,
  Receipt,
  TrendingUp,
} from "lucide-react";

type Summary = {
  totalSales: number;
  paidOrders: number;
  averageTicket: number;
  cash: number;
  card: number;
  transfer: number;
  activeChildren: number;
  completedChildAccess: number;
  pendingReservations: number;
  confirmedReservations: number;
  lowStockProducts: number;
};

type SalesByDay = { date: string; revenue: number; orders: number };
type CategorySales = { category: string; amount: number };
type PaymentMethod = { method: string; amount: number };
type PeakHour = { hour: number; total: number; orders: number };
type WaiterSale = { userId: string; name: string; total: number; orders: number };
type ChildAccessReport = { active: number; completed: number; overtime: number; revenue: number; extras: number };
type ReservationsReport = { total: number; pending: number; confirmed: number; cancelled: number; completed: number; deposits: number; pendingBalance: number };
type LowStock = { id: string; name: string; sku?: string | null; currentStock: number; minStock: number; unit: string };
type CashShift = { id: string; closedAt?: string; cashier: string; expectedCash: number; closingBalance: number; cashDifference: number; totalSales: number };

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"];

function KpiCard({
  title,
  value,
  icon: Icon,
  format = "number",
}: {
  title: string;
  value: number;
  icon: typeof DollarSign;
  format?: "currency" | "number";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">
              {format === "currency" ? formatCurrency(value) : value.toLocaleString("es-MX")}
            </p>
          </div>
          <div className="rounded-md bg-blue-50 p-2.5">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] ?? {});
  const body = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [byCategory, setByCategory] = useState<CategorySales[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [waiterSales, setWaiterSales] = useState<WaiterSale[]>([]);
  const [childAccess, setChildAccess] = useState<ChildAccessReport | null>(null);
  const [reservations, setReservations] = useState<ReservationsReport | null>(null);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [cashShifts, setCashShifts] = useState<CashShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const params = useMemo(() => ({ branchId, start: dateFrom, end: dateTo }), [branchId, dateFrom, dateTo]);

  const loadReport = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      reportsApi.getSummary(params),
      reportsApi.salesByDay(params),
      reportsApi.salesByCategory(params),
      reportsApi.paymentMethods(params),
      reportsApi.peakHours(params),
      reportsApi.waiterSales(params),
      reportsApi.childAccess(params),
      reportsApi.reservations(params),
      reportsApi.inventoryLowStock(branchId),
      reportsApi.cashShifts(params),
    ])
      .then(([summaryData, dayData, categoryData, methodData, hourData, waiterData, childData, reservationData, stockData, shiftData]) => {
        setSummary(summaryData);
        setSalesByDay(dayData);
        setByCategory(categoryData);
        setPaymentMethods(methodData);
        setPeakHours(hourData.filter((item: PeakHour) => item.total > 0 || item.orders > 0));
        setWaiterSales(waiterData);
        setChildAccess(childData);
        setReservations(reservationData);
        setLowStock(stockData);
        setCashShifts(shiftData);
      })
      .catch(() => {
        setLoadError("No se pudieron cargar los reportes. Verifica permisos y API.");
      })
      .finally(() => setIsLoading(false));
  }, [branchId, params]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportRows = [
    { metric: "Ventas totales", value: summary?.totalSales ?? 0 },
    { metric: "Ordenes pagadas", value: summary?.paidOrders ?? 0 },
    { metric: "Ticket promedio", value: summary?.averageTicket ?? 0 },
    { metric: "Efectivo", value: summary?.cash ?? 0 },
    { metric: "Tarjeta", value: summary?.card ?? 0 },
    { metric: "Transferencia", value: summary?.transfer ?? 0 },
    { metric: "Reservas pendientes", value: summary?.pendingReservations ?? 0 },
    { metric: "Stock bajo", value: summary?.lowStockProducts ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Dashboard ejecutivo de ventas, caja, reservas e inventario"
        actions={
          <Button variant="outline" size="sm" onClick={() => downloadCsv(`playcoffee-reportes-${dateFrom}-${dateTo}.csv`, exportRows)}>
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

      {loadError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard title="Ventas" value={summary?.totalSales ?? 0} icon={DollarSign} format="currency" />
            <KpiCard title="Tickets pagados" value={summary?.paidOrders ?? 0} icon={Receipt} />
            <KpiCard title="Ticket promedio" value={summary?.averageTicket ?? 0} icon={TrendingUp} format="currency" />
            <KpiCard title="Ninos activos" value={summary?.activeChildren ?? 0} icon={Baby} />
            <KpiCard title="Stock bajo" value={summary?.lowStockProducts ?? 0} icon={Package} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>Ventas por dia</CardTitle></CardHeader>
              <CardContent>
                {salesByDay.length === 0 ? <EmptyChart message="Sin ventas pagadas en el periodo." /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={salesByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Ventas"]} />
                      <Area dataKey="revenue" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Metodos de pago</CardTitle></CardHeader>
              <CardContent>
                {paymentMethods.length === 0 ? <EmptyChart message="Sin pagos registrados." /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={paymentMethods} innerRadius={55} outerRadius={85} dataKey="amount" nameKey="method">
                        {paymentMethods.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [formatCurrency(Number(value))]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Ventas por categoria</CardTitle></CardHeader>
              <CardContent>
                {byCategory.length === 0 ? <EmptyChart message="Sin categorias vendidas." /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Ventas"]} />
                      <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Horarios pico</CardTitle></CardHeader>
              <CardContent>
                {peakHours.length === 0 ? <EmptyChart message="Sin ventas por hora." /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={(value) => `${value}:00 hrs`} formatter={(value) => [formatCurrency(Number(value)), "Ventas"]} />
                      <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Ventas por mesero/cajero</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {waiterSales.length === 0 ? <EmptyChart message="Sin ventas asignadas." /> : waiterSales.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{item.orders} ordenes</p></div>
                    <p className="font-bold">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Control infantil</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {[
                  ["Activos", childAccess?.active ?? 0],
                  ["Completados", childAccess?.completed ?? 0],
                  ["Tiempo excedido", childAccess?.overtime ?? 0],
                  ["Ingresos", formatCurrency(childAccess?.revenue ?? 0)],
                  ["Extras", formatCurrency(childAccess?.extras ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between rounded-md bg-muted p-2"><span>{label}</span><strong>{value}</strong></div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Reservas</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {[
                  ["Total", reservations?.total ?? 0],
                  ["Pendientes", reservations?.pending ?? 0],
                  ["Confirmadas", reservations?.confirmed ?? 0],
                  ["Canceladas", reservations?.cancelled ?? 0],
                  ["Anticipos", formatCurrency(reservations?.deposits ?? 0)],
                  ["Saldo pendiente", formatCurrency(reservations?.pendingBalance ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between rounded-md bg-muted p-2"><span>{label}</span><strong>{value}</strong></div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Stock bajo</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lowStock.length === 0 ? <EmptyChart message="Sin productos debajo del minimo." /> : lowStock.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-md border p-3 text-sm">
                    <div><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{item.sku ?? "Sin SKU"}</p></div>
                    <p className="font-bold">{item.currentStock} / {item.minStock} {item.unit}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cortes de caja</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {cashShifts.length === 0 ? <EmptyChart message="Sin cortes cerrados en el periodo." /> : cashShifts.map((shift) => (
                  <div key={shift.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between"><strong>{shift.cashier}</strong><span>{shift.closedAt ? new Date(shift.closedAt).toLocaleDateString("es-MX") : "Abierto"}</span></div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Ventas {formatCurrency(shift.totalSales)}</span>
                      <span>Esperado {formatCurrency(shift.expectedCash)}</span>
                      <span>Contado {formatCurrency(shift.closingBalance)}</span>
                      <span className={shift.cashDifference === 0 ? "" : "text-red-600"}>Dif. {formatCurrency(shift.cashDifference)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
