"use client";

import { OrderPaneSwitcher } from "@/components/orders/OrderPaneSwitcher";

import { PreparationNotes } from "@/components/print/PreparationNotes";

import { CashierTicketActions } from "@/components/print/CashierTicketActions";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage, ordersApi, productsApi, tablesApi } from "@/lib/api";
import { createPaymentAttemptId } from "@/lib/payment-id";
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
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
};

const activeOrderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"];

function getOpenOrder(table: RestaurantTable | null | undefined) {
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
  const { tables, loadTables, updateTableLocal, replaceTablesLocal, saveLayout, cancelChanges, isSaving: isSavingLayout, isLoading: tablesLoading, error: layoutError } = useTableLayout(
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
  const [mobileCommanderView, setMobileCommanderView] = useState<"products" | "ticket">("products");
  const [commanderOpen, setCommanderOpen] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const createBusy = useRef(false);
  const sendBusy = useRef(false);
  const commanderVersion = useRef(0);
  const createAttempt = useRef<string | null>(null);
  const additionAttempt = useRef<{ signature: string; id: string } | null>(null);
  const currentOrderId = currentOrder?.id;
  const selectedTableId = selectedOperationalTable?.id;

  const refreshCommander = useCallback(() => {
    if (!commanderOpen || !selectedTableId || createBusy.current || sendBusy.current) return;
    const version = commanderVersion.current;
    void (async () => {
      const orderId = currentOrderId ?? getOpenOrder((await tablesApi.getAll(branchId)).find((t: RestaurantTable) => t.id === selectedTableId))?.id;
      if (!orderId) return;
      const order = await ordersApi.getOne(orderId);
      if (version !== commanderVersion.current) return;
      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        setCurrentOrder(null); setDraftItems([]); setGuestCount('');
        createAttempt.current = null; additionAttempt.current = null;
        setSelectedOperationalTable(table => table && ({ ...table, status: 'AVAILABLE', orders: [] }));
      } else setCurrentOrder(order);
    })().catch(() => undefined);
  }, [commanderOpen, selectedTableId, currentOrderId, branchId]);

  useEffect(() => {
    if (!commanderOpen) return;
    const timer = window.setInterval(refreshCommander, 15000);
    return () => window.clearInterval(timer);
  }, [commanderOpen, refreshCommander]);

  useEffect(() => {
    setEditMode(false);
    useTablesStore.getState().resetChanges();
    return () => {
      useTablesStore.getState().setEditMode(false);
      useTablesStore.getState().resetChanges();
    };
  }, [setEditMode]);

  const { data: areasData, isLoading: areasLoading, refetch: refetchAreas } = useQuery({
    queryKey: ["tables", "areas", branchId],
    queryFn: () => tablesApi.getAreas(branchId),
  });

  const refreshTables = useCallback(() => {
    if (useTablesStore.getState().isEditMode) return;
    refetchAreas();
    loadTables();
  }, [loadTables, refetchAreas]);

  const realtimeEvents = useMemo(
    () => ({
      "table.updated": () => { refreshTables(); refreshCommander(); },
      "table.status.changed": () => { refreshTables(); refreshCommander(); },
      "table.layout.updated": () => { refreshTables(); refreshCommander(); },
      "order.created": () => { refreshTables(); refreshCommander(); },
      "order.updated": () => { refreshTables(); refreshCommander(); },
      "order.sent_to_kitchen": () => { refreshTables(); refreshCommander(); },
      "order.completed": () => { refreshTables(); refreshCommander(); },
      "order.cancelled": () => { refreshTables(); refreshCommander(); },
    }),
    [refreshTables, refreshCommander],
  );
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => {
    if (areasData) {
      setAreas(areasData);
      if (!areasData.some((area: { id: string }) => area.id === selectedAreaId)) {
        selectArea(areasData[0]?.id ?? null);
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

    commanderVersion.current += 1;
    const version = commanderVersion.current;
    createAttempt.current = null; additionAttempt.current = null;
    setCurrentOrder(null);
    setOperationError(null);
    setDraftItems([]);
    setGuestCount("");
    setSelectedOperationalTable(table);
    selectTable(table);
    setCommanderOpen(true);
    setMobileCommanderView(getOpenOrder(table) ? "ticket" : "products");
    loadProducts();

    const openOrder = getOpenOrder(table);
    if (!openOrder) {
      setCurrentOrder(null);
      return;
    }

    setIsSavingOrder(true);
    try {
      const order = await ordersApi.getOne(openOrder.id);
      if (version !== commanderVersion.current) return;
      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        setCurrentOrder(null); setSelectedOperationalTable({ ...table, status: 'AVAILABLE', orders: [] }); refreshTables();
      } else setCurrentOrder(order);
    } catch {
      setOperationError("No se pudo cargar la comanda existente.");
      setCurrentOrder(openOrder);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const createOrderForTable = async () => {
    if (!selectedOperationalTable || createBusy.current) return null;
    createBusy.current = true;
    setIsSavingOrder(true);
    setOperationError(null);
    try {
      const order = await ordersApi.create({
        branchId,
        requestId: (createAttempt.current ??= createPaymentAttemptId()),
        tableId: selectedOperationalTable.id,
        notes: guestCount ? `Personas: ${guestCount}` : undefined,
        items: [],
      });
      setCurrentOrder(order);
      refreshTables();
      return order as Order;
    } catch (error) {
      refreshTables();
      setOperationError(getApiErrorMessage(error, "No se pudo abrir la mesa. Verifica permisos y conexion."));
      return null;
    } finally {
      createBusy.current = false;
      setIsSavingOrder(false);
    }
  };

  const addDraftItem = (product: Product) => {
    if (sendBusy.current || createBusy.current) return;
    setDraftItems((items) => {
      const existing = items.find((item) => item.product.id === product.id && !item.notes?.trim());
      if (existing) {
        return items.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { id: createPaymentAttemptId(), product, quantity: 1 }];
    });
  };

  const updateDraftQuantity = (itemId: string, quantity: number) => {
    if (sendBusy.current || createBusy.current) return;
    if (quantity <= 0) {
      setDraftItems((items) => items.filter((item) => item.id !== itemId));
      return;
    }
    setDraftItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const splitDraftItem = (itemId: string) => {
    if (sendBusy.current || createBusy.current) return;
    setDraftItems(items => {
      const item = items.find(row => row.id === itemId);
      if (!item || item.quantity <= 1) return items;
      return [...items.map(row => row.id === itemId ? { ...row, quantity: row.quantity - 1 } : row), { ...item, id: createPaymentAttemptId(), quantity: 1 }];
    });
  };

  const sendDraftItems = async () => {
    if (sendBusy.current || isSavingOrder || draftItems.length === 0) return;
    sendBusy.current = true;
    const order = currentOrder && activeOrderStatuses.includes(currentOrder.status) ? currentOrder : (await createOrderForTable());
    if (!order) { sendBusy.current = false; return; }

    setIsSavingOrder(true);
    setOperationError(null);
    try {
      const addition = {
        items: draftItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          notes: item.notes,
        })),
      };
      const signature = JSON.stringify({ orderId: order.id, ...addition });
      if (additionAttempt.current?.signature !== signature) additionAttempt.current = { signature, id: createPaymentAttemptId() };
      await ordersApi.addItems(order.id, { ...addition, requestId: additionAttempt.current.id });
      const updated = await ordersApi.getOne(order.id);
      setCurrentOrder(updated);
      setDraftItems([]);
      additionAttempt.current = null;
      refreshTables();
    } catch (err) {
      setOperationError(getApiErrorMessage(err, "No se pudieron agregar los productos al ticket."));
    } finally {
      sendBusy.current = false;
      setIsSavingOrder(false);
    }
  };

  const handleSave = async () => {
    if (!canEditLayout) return;
    const success = await saveLayout();
    if (success) {
      setEditMode(false);
      refreshTables();
    }
  };

  const handleCancel = () => {
    cancelChanges();
    setEditMode(false);
    selectTable(null);
    refreshTables();
  };

  const handleTableUpdate = (id: string, updates: Partial<RestaurantTable>) => {
    if (!canEditLayout) return;
    updateTableLocal(id, updates);
  };

  const handleTablesUpdate = (updatedTables: RestaurantTable[]) => {
    if (!canEditLayout || !tables) return;
    replaceTablesLocal(updatedTables);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Gestion de Mesas"
          description={
            isEditMode
              ? "Modo Diseno - Arrastra y edita las mesas"
              : "Toca una mesa para abrir o continuar la comanda"
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <RealtimeIndicator status={realtimeStatus} />
          {!isEditMode && (
            <>
              <Button variant="outline" size="sm" onClick={refreshTables}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
              {canEditLayout && (
                <Button variant="outline" size="sm" disabled={areasLoading || tablesLoading || !!layoutError || !selectedAreaId} onClick={() => setEditMode(true)}>
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

      {layoutError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{layoutError}</p>}
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
          onValueChange={(id) => {
            if (isSavingLayout) return;
            if (isEditMode && useTablesStore.getState().hasUnsavedChanges &&
                !window.confirm("Hay cambios sin guardar. ¿Descartarlos y cambiar de area?")) return;
            if (isEditMode) handleCancel();
            selectArea(id);
          }}
          className="flex flex-1 flex-col"
        >
          <TabsList className="w-full shrink-0 justify-start overflow-x-auto">
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
                  key={area.id}
                  areaId={area.id}
                  isSaving={isSavingLayout}
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

      <Dialog open={commanderOpen} onOpenChange={open => { if (isSavingOrder) return; commanderVersion.current += 1; setCommanderOpen(open); }}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-5xl lg:h-[92dvh]">
          <DialogHeader>
            <DialogTitle>
              Mesa {selectedOperationalTable?.number}
              {selectedOperationalTable?.area?.name ? ` - ${selectedOperationalTable.area.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          <OrderPaneSwitcher value={mobileCommanderView} onChange={setMobileCommanderView} count={countItems(displayOrder, draftItems)} />
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[1fr_360px]">
            <div className={`${mobileCommanderView === "products" ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto rounded-lg border lg:flex`}>
              <div className="shrink-0 border-b p-3">
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
              <div role="region" aria-label="Catalogo de productos" tabIndex={0} className="min-h-24 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable]">
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

            <div className={`${mobileCommanderView === "ticket" ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto rounded-lg border bg-slate-50 lg:flex`}>
              <div className="shrink-0 border-b bg-white p-2 lg:p-4">
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

              <div role="region" aria-label="Productos de la comanda" tabIndex={0} className="min-h-24 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable]">
                {!displayOrder && draftItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-white p-5 text-center text-sm text-muted-foreground">
                    Mesa libre. Agrega productos o abre la mesa para crear la orden.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayOrder?.items?.length ? (
                      <div className="rounded-lg border bg-white">
                        <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Productos del ticket
                        </div>
                        {displayOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                              {item.quantity}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.product.name}</p>
                              {item.notes && <p className="whitespace-pre-wrap break-words text-xs text-blue-700">Preparación: {item.notes}</p>}
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
                          <div key={item.id} className="flex flex-wrap items-center gap-2 border-b px-3 py-2 last:border-0">
                            <div className="w-full min-w-0">
                              <p className="truncate text-sm font-medium">{item.product.name}</p>
                              <PreparationNotes name={item.product.name} quantity={item.quantity} value={item.notes} disabled={isSavingOrder} onChange={notes => setDraftItems(items => items.map(row => row.id === item.id ? { ...row, notes } : row))} />
                              {item.quantity > 1 && <Button size="sm" variant="outline" className="mt-1" disabled={isSavingOrder} onClick={() => splitDraftItem(item.id)}>Separar 1</Button>}
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(Number(item.product.price) * item.quantity)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateDraftQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateDraftQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => updateDraftQuantity(item.id, 0)}
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

              <div className="shrink-0 border-t bg-white p-3 lg:p-4">
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
                {displayOrder && <CashierTicketActions orderId={displayOrder.id} status={displayOrder.status} />}
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

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setCommanderOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
