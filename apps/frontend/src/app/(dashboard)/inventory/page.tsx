"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inventoryApi, productsApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, ArrowUpDown, Loader2, Package, Plus, TrendingDown, TrendingUp,
} from "lucide-react";
import type { Product } from "@/types/pos.types";
import { useRealtime } from "@/hooks/useRealtime";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";

type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "WASTE" | "TRANSFER";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number | string;
  minStock: number | string;
  costPerUnit?: number | string;
  product?: { category?: { name: string } };
}

interface StockMovement {
  id: string;
  inventoryItemId: string;
  inventoryItem?: { name: string };
  type: MovementType;
  quantity: number | string;
  notes?: string;
  reason?: string;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<MovementType, { label: string; icon: typeof TrendingUp; color: string }> = {
  IN: { label: "Entrada", icon: TrendingUp, color: "text-green-600" },
  OUT: { label: "Salida", icon: TrendingDown, color: "text-red-600" },
  ADJUSTMENT: { label: "Ajuste", icon: ArrowUpDown, color: "text-blue-600" },
  WASTE: { label: "Merma", icon: TrendingDown, color: "text-orange-600" },
  TRANSFER: { label: "Transferencia", icon: ArrowUpDown, color: "text-violet-600" },
};

export default function InventoryPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"items" | "movements">("items");
  const [movementOpen, setMovementOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [movForm, setMovForm] = useState({
    type: "IN" as MovementType,
    quantity: "",
    reason: "",
  });
  const [itemForm, setItemForm] = useState({
    productId: "none",
    name: "",
    unit: "unit",
    currentStock: "",
    minStock: "0",
    costPerUnit: "0",
  });

  const loadData = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      inventoryApi.getItems(branchId),
      inventoryApi.getMovements({ branchId }),
      productsApi.getAll({ isActive: "true" }),
    ])
      .then(([nextItems, nextMovements, nextProducts]) => {
        setItems(nextItems);
        setMovements(nextMovements);
        setProducts(nextProducts);
      })
      .catch(() => {
        setItems([]);
        setMovements([]);
        setLoadError("No se pudo cargar el inventario. Verifica que la API este disponible.");
      })
      .finally(() => setIsLoading(false));
  }, [branchId]);

  const realtimeEvents = useMemo(() => ({
    "inventory.stock.changed": () => loadData(),
    "inventory.low_stock": () => loadData(),
    "order.completed": () => loadData(),
    "order.cancelled": () => loadData(),
  }), [loadData]);
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMovement = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setLoadError(null);
    try {
      await inventoryApi.addMovement({
        inventoryItemId: selectedItem.id,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        reason: movForm.reason || undefined,
      });
      setMovementOpen(false);
      setSelectedItem(null);
      setMovForm({ type: "IN", quantity: "", reason: "" });
      loadData();
    } catch {
      setLoadError("No se pudo registrar el movimiento. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateItem = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    try {
      const selectedProduct = products.find((product) => product.id === itemForm.productId);
      await inventoryApi.create({
        productId: itemForm.productId === "none" ? undefined : itemForm.productId,
        name: itemForm.name || selectedProduct?.name,
        unit: itemForm.unit,
        currentStock: Number(itemForm.currentStock || 0),
        minStock: Number(itemForm.minStock || 0),
        costPerUnit: Number(itemForm.costPerUnit || 0),
      });
      setItemOpen(false);
      setItemForm({ productId: "none", name: "", unit: "unit", currentStock: "", minStock: "0", costPerUnit: "0" });
      loadData();
    } catch {
      setLoadError("No se pudo crear el item de inventario. Revisa duplicados y campos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const query = search.toLowerCase();
    const category = item.product?.category?.name ?? "";
    const matches = item.name.toLowerCase().includes(query) || category.toLowerCase().includes(query);
    const isLow = Number(item.currentStock) <= Number(item.minStock);
    return matches && (!onlyLowStock || isLow);
  });

  const lowStockItems = items.filter((item) => Number(item.currentStock) <= Number(item.minStock));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Control de stock e insumos"
        actions={
          <div className="flex gap-2">
            <RealtimeIndicator status={realtimeStatus} />
            <Button variant={view === "items" ? "default" : "outline"} size="sm" onClick={() => setView("items")}>
              <Package className="mr-2 h-4 w-4" />Stock
            </Button>
            <Button variant={view === "movements" ? "default" : "outline"} size="sm" onClick={() => setView("movements")}>
              <ArrowUpDown className="mr-2 h-4 w-4" />Movimientos
            </Button>
            <Button size="sm" onClick={() => setItemOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Item
            </Button>
          </div>
        }
      />

      {lowStockItems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Stock bajo en {lowStockItems.length} articulo(s)</p>
              <p className="mt-0.5 text-sm text-amber-700">
                {lowStockItems.map((item) => item.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === "items" ? (
        <div className="space-y-4">
          <Input
            placeholder="Buscar articulo o categoria..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
          />
          <Button
            variant={onlyLowStock ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyLowStock((value) => !value)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Stock bajo
          </Button>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articulo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Minimo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay articulos de inventario.
                    </TableCell>
                  </TableRow>
                ) : filteredItems.map((item) => {
                  const currentStock = Number(item.currentStock);
                  const minStock = Number(item.minStock);
                  const isLow = currentStock <= minStock;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.product?.category?.name ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={cn(isLow && "font-bold text-red-600")}>{currentStock} {item.unit}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{minStock} {item.unit}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="text-xs">Stock bajo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelectedItem(item);
                          setMovementOpen(true);
                        }}>
                          <Plus className="mr-1 h-3.5 w-3.5" />Movimiento
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader><CardTitle>Historial de Movimientos</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Articulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No hay movimientos registrados.
                  </TableCell>
                </TableRow>
              ) : movements.map((movement) => {
                const cfg = MOVEMENT_LABELS[movement.type];
                const Icon = cfg.icon;
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">{movement.inventoryItem?.name ?? "-"}</TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-sm", cfg.color)}>
                        <Icon className="h-3.5 w-3.5" />{cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{Number(movement.quantity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movement.reason ?? movement.notes ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(movement.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={movementOpen} onOpenChange={(open) => { setMovementOpen(open); if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Registrar Movimiento</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium text-muted-foreground">
                Articulo: <span className="text-foreground">{selectedItem.name}</span>
                <br />Stock actual: <span className="font-mono font-bold">{Number(selectedItem.currentStock)} {selectedItem.unit}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={movForm.type} onValueChange={(value) => setMovForm((form) => ({ ...form, type: value as MovementType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Salida</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                    <SelectItem value="WASTE">Merma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad ({selectedItem.unit})</Label>
                <Input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={movForm.quantity}
                  onChange={(event) => setMovForm((form) => ({ ...form, quantity: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Textarea
                  placeholder="Proveedor, merma, ajuste..."
                  value={movForm.reason}
                  onChange={(event) => setMovForm((form) => ({ ...form, reason: event.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovement} disabled={!movForm.quantity || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Crear item de inventario</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <Select
                value={itemForm.productId}
                onValueChange={(value) => {
                  const product = products.find((item) => item.id === value);
                  setItemForm((form) => ({
                    ...form,
                    productId: value,
                    name: product?.name ?? form.name,
                    costPerUnit: product?.cost ? String(product.cost) : form.costPerUnit,
                  }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin producto ligado</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={itemForm.name} onChange={(event) => setItemForm((form) => ({ ...form, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Input value={itemForm.unit} onChange={(event) => setItemForm((form) => ({ ...form, unit: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock actual</Label>
                <Input type="number" min="0" step="0.001" value={itemForm.currentStock} onChange={(event) => setItemForm((form) => ({ ...form, currentStock: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock minimo</Label>
                <Input type="number" min="0" step="0.001" value={itemForm.minStock} onChange={(event) => setItemForm((form) => ({ ...form, minStock: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Costo unitario</Label>
                <Input type="number" min="0" step="0.01" value={itemForm.costPerUnit} onChange={(event) => setItemForm((form) => ({ ...form, costPerUnit: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateItem} disabled={isSubmitting || !itemForm.name}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
