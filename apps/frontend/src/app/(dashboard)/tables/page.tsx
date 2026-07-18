"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage, ordersApi, productsApi, tablesApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useAreasStore } from "@/store/areas.store";
import { useTablesStore } from "@/store/tables.store";
import { useTableLayout } from "@/hooks/useTableLayout";
import { useRealtime } from "@/hooks/useRealtime";
import { TableCanvas } from "@/components/tables/TableCanvas";
import { LayoutEditor } from "@/components/tables/LayoutEditor";
import { PageHeader } from "@/components/layout/page-header";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChefHat,
  Clock,
  Grid3x3,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import type { Product } from "@/types/pos.types";
import type { Order, RestaurantTable } from "@/types/orders.types";

type DraftItem = {
  product: Product;
  quantity: number;
};

const activeOrderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"];

function getOpenOrder(table: RestaurantTable | null) {
  return table?.orders?.find((order) => activeOrderStatuses.includes(order.status)) ?? null;
}

function getElapsedMinutes(order: Order | null) {
  if (!order?.createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
}

function countItems(order: Order | null, draftItems: DraftItem[] = []) {
  const sent = order?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const draft = draftItems.reduce((sum, item) => sum + item.quantity, 0);
  return sent + draft;
}

export default function TablesPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const canEditLayout =
    user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || user?.role === "CASHIER";
  const { areas, setAreas, selectedAreaId, selectArea } = useAreasStore();
  const { isEditMode, setEditMode, selectedTable, selectTable } = useTablesStore();
  const { tables, loadTables, updateTableLocal, saveLayout, cancelChanges } = useTableLayout(
    selectedAreaId || "",
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedOperationalTable, setSelectedOperationalTable] =
    useState<RestaurantTable | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [guestCount, setGuestCount] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [commanderOpen, setCommanderOpen] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const { data: areasData, isLoading: areasLoading, refetch: refetchAreas } = useQuery({
    queryKey: ["tables", "areas", branchId],
    queryFn: () => tablesApi.getAreas(branchId),
  });

  const refreshTables = useCallback(() => {
    refetchAreas();
    loadTables();
  }, [loadTables, refetchAreas]);

  const realtimeEvents = useMemo(
    () => ({
      "table.updated": () => refreshTables(),
      "table.status.changed": () => refreshTables(),
      "table.layout.updated": () => refreshTables(),
      "order.created": () => refreshTables(),
      "order.updated": () => refreshTables(),
      "order.sent_to_kitchen": () => refreshTables(),
      "order.completed": () => refreshTables(),
      "order.cancelled": () => refreshTables(),
    }),
    [refreshTables],
  );
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => {
    if (areasData && areasData.length > 0) {
      setAreas(areasData);
      if (!selectedAreaId) {
        selectArea(areasData[0].id);
      }
    }
  }, [areasData, setAreas, selectedAreaId, selectArea]);

  useEffect(() => {
    if (selectedAreaId) {
      loadTables();
    }
  }, [selectedAreaId, loadTables]);

  useEffect(() => {
    if (!canEditLayout && isEditMode) {
      setEditMode(false);
    }
  }, [canEditLayout, isEditMode, setEditMode]);

  const loadProducts = useCallback(() => {
    setProductsLoading(true);
    productsApi
      .getAll({ isActive: "true" })
      .then(setProducts)
      .catch(() => setOperationError("No se pudieron cargar los productos."))
      .finally(() => setProductsLoading(false));
  }, []);

  const openCommander = async (table: RestaurantTable) => {
    if (isEditMode) {
      selectTable(table);
      return;
    }

    setOperationError(null);
    setDraftItems([]);
    setGuestCount("");
    setSelectedOperationalTable(table);
    selectTable(table);
    setCommanderOpen(true);
    loadProducts();

    const openOrder = getOpenOrder(table);
    if (!openOrder) {
      setCurrentOrder(null);
      return;
    }

    setIsSavingOrder(true);
    try {
      const order = await ordersApi.getOne(openOrder.id);
      setCurrentOrder(order);
    } catch {
      setOperationError("No se pudo cargar la comanda existente.");
      setCurrentOrder(openOrder);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const createOrderForTable = async () => {
    if (!selectedOperationalTable) return null;
    setIsSavingOrder(true);
    setOperationError(null);
    try {
      const order = await ordersApi.create({
        branchId,
        tableId: selectedOperationalTable.id,
        notes: guestCount ? `Personas: ${guestCount}` : undefined,
        items: [],
      });
      setCurrentOrder(order);
      refreshTables();
      return order as Order;
    } catch {
      setOperationError("No se pudo abrir la mesa. Verifica permisos y conexion.");
      return null;
    } finally {
      setIsSavingOrder(false);
    }
  };

  const addDraftItem = (product: Product) => {
    setDraftItems((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { product, quantity: 1 }];
    });
  };

  const updateDraftQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setDraftItems((items) => items.filter((item) => item.product.id !== productId));
      return;
    }
    setDraftItems((items) =>
      items.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    );
  };

  const sendDraftItems = async () => {
    if (isSavingOrder || draftItems.length === 0) return;
    const order = currentOrder ?? (await createOrderForTable());
    if (!order) return;

    setIsSavingOrder(true);
    setOperationError(null);
    try {
      await ordersApi.addItems(order.id, {
        items: draftItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });
      const updated = await ordersApi.getOne(order.id);
      setCurrentOrder(updated);
      setDraftItems([]);
      refreshTables();
    } catch (err) {
      setOperationError(getApiErrorMessage(err, "No se pudieron agregar los productos al ticket."));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSave = async () => {
    if (!canEditLayout) return;
    const success = await saveLayout();
    if (success) {
      setEditMode(false);
    }
  };

  const handleCancel = () => {
    cancelChanges();
    setEditMode(false);
    selectTable(null);
  };

  const handleTableUpdate = (id: string, updates: Partial<RestaurantTable>) => {
    if (!canEditLayout) return;
    updateTableLocal(id, updates);
  };

  const handleTablesUpdate = (updatedTables: RestaurantTable[]) => {
    if (!canEditLayout || !tables) return;
    updatedTables.forEach((table) => {
      const original = tables.find((current) => current.id === table.id);
      if (!original) return;

      const changes = Object.keys(table).reduce((acc, key) => {
        const tableKey = key as keyof RestaurantTable;
        if (table[tableKey] !== original[tableKey]) {
          acc[tableKey] = table[tableKey] as any;
        }
        return acc;
      }, {} as Partial<RestaurantTable>);

      if (Object.keys(changes).length > 0) {
        updateTableLocal(table.id, changes);
      }
    });
  };

  const stats = {
    total: tables?.length || 0,
    available: tables?.filter((table) => table.status === "AVAILABLE").length || 0,
    occupied: tables?.filter((table) => table.status === "OCCUPIED").length || 0,
    reserved: tables?.filter((table) => table.status === "RESERVED").length || 0,
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()),
  );
  const draftTotal = draftItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );
  const orderTotal = Number(currentOrder?.total ?? 0);
  const displayOrder = currentOrder ?? getOpenOrder(selectedOperationalTable);
  const elapsed = getElapsedMinutes(displayOrder);

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Gestion de Mesas"
          description={
            isEditMode
              ? "Modo Diseno - Arrastra y edita las mesas"
              : "Toca una mesa para abrir o continuar la comanda"
          }
        />

        <div className="flex items-center gap-2">
          <RealtimeIndicator status={realtimeStatus} />
          {!isEditMode && (
            <>
              <Button variant="outline" size="sm" onClick={refreshTables}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
              {canEditLayout && (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Modo Diseno
                </Button>
              )}
            </>
          )}
          {isEditMode && (
            <Badge variant="default" className="px-3 py-2 text-sm">
              <Grid3x3 className="mr-2 h-4 w-4" />
              Editando Layout
            </Badge>
          )}
        </div>
      </div>

      {!isEditMode && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Libres</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.available}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">Ocupadas</p>
            <p className="text-2xl font-bold text-blue-700">{stats.occupied}</p>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Reservadas</p>
            <p className="text-2xl font-bold text-amber-700">{stats.reserved}</p>
          </Card>
        </div>
      )}

      {areasLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : areas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="mb-4 text-muted-foreground">
            No hay areas configuradas. Crea areas desde Configuracion &gt; Areas para comenzar.
          </p>
          {canEditLayout && (
            <Button onClick={() => { window.location.href = "/settings/areas"; }}>
              Ir a Configuracion de Areas
            </Button>
          )}
        </Card>
      ) : (
        <Tabs
          value={selectedAreaId || areas[0]?.id}
          onValueChange={selectArea}
          className="flex flex-1 flex-col"
        >
          <TabsList className="w-full justify-start">
            {areas.map((area) => (
              <TabsTrigger
                key={area.id}
                value={area.id}
                style={{
                  borderBottomColor: area.color,
                  borderBottomWidth: selectedAreaId === area.id ? "3px" : "0",
                }}
              >
                {area.name}
                {area._count && area._count.tables > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {area._count.tables}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {areas.map((area) => (
            <TabsContent
              key={area.id}
              value={area.id}
              className="mt-4 flex-1 overflow-hidden rounded-lg border"
            >
              {isEditMode && canEditLayout ? (
                <LayoutEditor
                  tables={(tables || []).filter((table) => table.areaId === area.id)}
                  onTablesUpdate={handleTablesUpdate}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              ) : (
                <TableCanvas
                  tables={(tables || []).filter((table) => table.areaId === area.id)}
                  isEditMode={false}
                  selectedTableId={selectedTable?.id}
                  onTableSelect={openCommander}
                  onTableUpdate={handleTableUpdate}
                  areaName={area.name}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog open={commanderOpen} onOpenChange={setCommanderOpen}>
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Mesa {selectedOperationalTable?.number}
              {selectedOperationalTable?.area?.name ? ` - ${selectedOperationalTable.area.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="grid min-h-[620px] gap-4 overflow-hidden lg:grid-cols-[1fr_360px]">
            <div className="flex min-h-0 flex-col rounded-lg border">
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar producto"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {productsLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No hay productos disponibles.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addDraftItem(product)}
                        className="rounded-lg border bg-card p-3 text-left transition hover:border-blue-400 hover:shadow-sm active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-tight">{product.name}</p>
                          {product.preparationStation !== "NONE" && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {product.preparationStation === "KITCHEN" ? "Cocina" : "Barra"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-3 text-lg font-bold text-blue-600">
                          {formatCurrency(Number(product.price))}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-lg border bg-slate-50">
              <div className="border-b bg-white p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                    <p className="mt-1 text-sm font-bold">{elapsed} min</p>
                    <p className="text-[10px] text-muted-foreground">Tiempo</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <ChefHat className="mx-auto h-4 w-4 text-muted-foreground" />
                    <p className="mt-1 text-sm font-bold">{countItems(displayOrder, draftItems)}</p>
                    <p className="text-[10px] text-muted-foreground">Productos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <Users className="mx-auto h-4 w-4 text-muted-foreground" />
                    <p className="mt-1 text-sm font-bold">{guestCount || "-"}</p>
                    <p className="text-[10px] text-muted-foreground">Personas</p>
                  </div>
                </div>

                {!displayOrder && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Personas en mesa (opcional)
                    </p>
                    <Input
                      type="number"
                      min="1"
                      value={guestCount}
                      onChange={(event) => setGuestCount(event.target.value)}
                      placeholder="Ej. 4"
                    />
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {!displayOrder && draftItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-white p-5 text-center text-sm text-muted-foreground">
                    Mesa libre. Agrega productos o abre la mesa para crear la orden.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayOrder?.items?.length ? (
                      <div className="rounded-lg border bg-white">
                        <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Enviados
                        </div>
                        {displayOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                              {item.quantity}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(Number(item.totalPrice))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {draftItems.length > 0 && (
                      <div className="rounded-lg border border-blue-200 bg-white">
                        <div className="border-b px-3 py-2 text-xs font-semibold text-blue-700">
                          Nuevos sin agregar
                        </div>
                        {draftItems.map((item) => (
                          <div key={item.product.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(Number(item.product.price) * item.quantity)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateDraftQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateDraftQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => updateDraftQuantity(item.product.id, 0)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {operationError && (
                <div className="mx-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {operationError}
                </div>
              )}

              <div className="border-t bg-white p-4">
                <div className="mb-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orden actual</span>
                    <span>{formatCurrency(orderTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nuevos</span>
                    <span>{formatCurrency(draftTotal)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Total mesa</span>
                    <span className="text-blue-600">{formatCurrency(orderTotal + draftTotal)}</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  {!displayOrder && (
                    <Button onClick={createOrderForTable} disabled={isSavingOrder}>
                      {isSavingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Abrir mesa
                    </Button>
                  )}
                  <Button onClick={sendDraftItems} disabled={isSavingOrder || draftItems.length === 0}>
                    {isSavingOrder ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Agregar al ticket
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCommanderOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
