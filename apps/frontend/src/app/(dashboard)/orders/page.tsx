"use client";

import { useEffect, useState } from "react";
import { ordersApi } from "@/lib/api";
import { useOrdersStore } from "@/store/orders.store";
import { formatCurrency, cn } from "@/lib/utils";
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

const mockOrders: Order[] = [
  {
    id: "o1", branchId: "b1", userId: "u1", orderNumber: "PC-A1B2C",
    status: "PREPARING", subtotal: 270, taxAmount: 0, discountAmount: 0,
    total: 270, tipAmount: 0, isDelivery: false, isTakeaway: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    table: { id: "t1", areaId: "a1", number: "3", capacity: 4, status: "OCCUPIED", isActive: true },
    user: { id: "u1", firstName: "Carlos", lastName: "R." },
    items: [
      { id: "i1", orderId: "o1", productId: "p1", quantity: 2, unitPrice: 65, totalPrice: 130, status: "PREPARING", product: { id: "p1", name: "Cappuccino" }, modifiers: [] },
      { id: "i2", orderId: "o1", productId: "p5", quantity: 1, unitPrice: 110, totalPrice: 110, status: "PREPARING", product: { id: "p5", name: "Avocado Toast" }, modifiers: [] },
    ],
    payments: [],
  },
  {
    id: "o2", branchId: "b1", userId: "u1", orderNumber: "PC-D3E4F",
    status: "PENDING", subtotal: 180, taxAmount: 0, discountAmount: 0,
    total: 180, tipAmount: 0, isDelivery: false, isTakeaway: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    table: { id: "t2", areaId: "a1", number: "7", capacity: 2, status: "OCCUPIED", isActive: true },
    user: { id: "u1", firstName: "Carlos", lastName: "R." },
    items: [
      { id: "i3", orderId: "o2", productId: "p2", quantity: 2, unitPrice: 70, totalPrice: 140, status: "PENDING", product: { id: "p2", name: "Latte" }, modifiers: [] },
    ],
    payments: [],
  },
];

export default function OrdersPage() {
  const { orders, setOrders, updateOrderStatus, isLoading, setLoading } = useOrdersStore();
  const [activeTab, setActiveTab] = useState("active");

  const loadOrders = () => {
    setLoading(true);
    ordersApi.getAll()
      .then(setOrders)
      .catch(() => setOrders(mockOrders))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const displayOrders = orders.length > 0 ? orders : mockOrders;

  const filteredOrders = (statuses: OrderStatus[]) =>
    displayOrders.filter((o) => statuses.includes(o.status));

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await ordersApi.updateStatus(orderId, { status });
    } catch { /* optimistic */ }
    updateOrderStatus(orderId, status);
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
