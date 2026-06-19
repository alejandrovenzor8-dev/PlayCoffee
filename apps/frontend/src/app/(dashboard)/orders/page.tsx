"use client";

import { useEffect, useState } from "react";
import { ordersApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useOrdersStore } from "@/store/orders.store";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/orders.types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, RefreshCw, ChevronRight, Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  PREPARING: { label: "Preparando", variant: "default" },
  READY: { label: "Lista", variant: "success" },
  DELIVERED: { label: "Entregada", variant: "secondary" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "success" },
};

const TABS: { value: string; label: string; statuses: OrderStatus[] }[] = [
  { value: "active", label: "Activas", statuses: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
  { value: "delivered", label: "Entregadas", statuses: ["DELIVERED"] },
  { value: "completed", label: "Completadas", statuses: ["COMPLETED"] },
  { value: "cancelled", label: "Canceladas", statuses: ["CANCELLED"] },
];

export default function OrdersPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const { orders, setOrders, updateOrder, isLoading, setLoading } = useOrdersStore();
  const [activeTab, setActiveTab] = useState("active");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = () => {
    setLoading(true);
    setLoadError(null);
    ordersApi.getAll({ branchId })
      .then(setOrders)
      .catch(() => {
        setOrders([]);
        setLoadError("No se pudieron cargar las ordenes. Verifica que la API este disponible.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, [branchId]);

  const filteredOrders = (statuses: OrderStatus[]) =>
    orders.filter((o) => statuses.includes(o.status));

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      const updated = await ordersApi.updateStatus(orderId, { status });
      updateOrder(updated);
    } catch {
      setLoadError("No se pudo actualizar la orden. Intenta de nuevo.");
    }
  };

  const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
    PENDING: "CONFIRMED",
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "DELIVERED",
    DELIVERED: "COMPLETED",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comandero"
        description="Gestión de órdenes en tiempo real"
        actions={
          <Button variant="outline" size="sm" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <TabsList>
          {TABS.map(({ value, label, statuses }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              <span className="ml-1.5 text-xs opacity-60">({filteredOrders(statuses).length})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, statuses }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOrders(statuses).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-12 w-12 opacity-30 mb-3" />
                  <p>No hay órdenes en esta categoría</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOrders(statuses).map((order) => {
                  const { label, variant } = STATUS_CONFIG[order.status];
                  const next = nextStatus[order.status];
                  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <div className="border-b px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                          {order.table && (
                            <p className="text-xs text-muted-foreground">Mesa {order.table.number}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{elapsed}m</span>
                          <Badge variant={variant as "default"}>{label}</Badge>
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <ul className="space-y-1.5">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-2 text-sm">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                {item.quantity}
                              </span>
                              <span className="flex-1">{item.product.name}</span>
                              <span className="text-muted-foreground">{formatCurrency(item.totalPrice)}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="flex items-center justify-between border-t pt-3">
                          <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(order.id, next)}
                            >
                              {STATUS_CONFIG[next].label}
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
