"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ordersApi, printApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useOrdersStore } from "@/store/orders.store";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import type { OrderStatus } from "@/types/orders.types";
import type { PrintTicketDocument, PrintTicketType } from "@/types/print.types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { BarTicket } from "@/components/print/BarTicket";
import { CustomerReceipt } from "@/components/print/CustomerReceipt";
import { KitchenTicket } from "@/components/print/KitchenTicket";
import { PrintableTicket } from "@/components/print/PrintableTicket";
import {
  ChefHat,
  ClipboardList,
  Coffee,
  Printer,
  RefreshCw,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";

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
  const [printDocument, setPrintDocument] = useState<PrintTicketDocument | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    ordersApi.getAll({ branchId })
      .then(setOrders)
      .catch(() => {
        setOrders([]);
        setLoadError("No se pudieron cargar las ordenes. Verifica que la API este disponible.");
      })
      .finally(() => setLoading(false));
  }, [branchId, setLoading, setOrders]);

  const realtimeEvents = useMemo(() => ({
    "order.created": () => loadOrders(),
    "order.updated": () => loadOrders(),
    "order.sent_to_kitchen": () => loadOrders(),
    "order.completed": () => loadOrders(),
    "order.cancelled": () => loadOrders(),
    "payment.created": () => loadOrders(),
    "order.payment_status.changed": () => loadOrders(),
  }), [loadOrders]);
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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

  const canPrintCustomer = user?.role === "ADMIN" || user?.role === "CASHIER";

  const handlePrint = async (orderId: string, type: PrintTicketType) => {
    setIsPrinting(`${orderId}-${type}`);
    setLoadError(null);
    try {
      const document =
        type === "CUSTOMER"
          ? await printApi.customer(orderId)
          : type === "KITCHEN"
            ? await printApi.kitchen(orderId)
            : await printApi.bar(orderId);
      setPrintDocument(document);
      setPrintOpen(true);
    } catch {
      setLoadError("No se pudo preparar el ticket. Verifica permisos y sucursal.");
    } finally {
      setIsPrinting(null);
    }
  };

  const renderPrintDocument = () => {
    if (!printDocument) return null;
    if (printDocument.type === "CUSTOMER") {
      return <CustomerReceipt document={printDocument} />;
    }
    if (printDocument.type === "KITCHEN") {
      return <KitchenTicket document={printDocument} />;
    }
    return <BarTicket document={printDocument} />;
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
          <div className="flex items-center gap-2">
            <RealtimeIndicator status={realtimeStatus} />
            <Button variant="outline" size="sm" onClick={loadOrders}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
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

                        <div className="grid grid-cols-3 gap-2 border-t pt-3">
                          {canPrintCustomer && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrint(order.id, "CUSTOMER")}
                              disabled={isPrinting === `${order.id}-CUSTOMER`}
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Cliente
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(order.id, "KITCHEN")}
                            disabled={isPrinting === `${order.id}-KITCHEN`}
                          >
                            <ChefHat className="h-3.5 w-3.5 mr-1" />
                            Cocina
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(order.id, "BAR")}
                            disabled={isPrinting === `${order.id}-BAR`}
                          >
                            <Coffee className="h-3.5 w-3.5 mr-1" />
                            Barra
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
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
      <PrintableTicket
        open={printOpen}
        onOpenChange={setPrintOpen}
        document={printDocument}
        title="Vista de impresion"
      >
        {renderPrintDocument()}
      </PrintableTicket>
    </div>
  );
}
