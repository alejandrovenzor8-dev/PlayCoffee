"use client";

import { useEffect, useState, useCallback } from "react";
import { inventoryApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, AlertTriangle, Plus, ArrowUpDown, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minStock: number;
  costPerUnit?: number;
  category?: string;
}

interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "WASTE";
  quantity: number;
  note?: string;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<StockMovement["type"], { label: string; icon: typeof TrendingUp; color: string }> = {
  IN: { label: "Entrada", icon: TrendingUp, color: "text-green-600" },
  OUT: { label: "Salida", icon: TrendingDown, color: "text-red-600" },
  ADJUSTMENT: { label: "Ajuste", icon: ArrowUpDown, color: "text-blue-600" },
  WASTE: { label: "Merma", icon: TrendingDown, color: "text-orange-600" },
};

const mockItems: InventoryItem[] = [
  { id: "inv1", name: "Café Espresso (kg)", unit: "kg", quantity: 12, minStock: 5, costPerUnit: 180, category: "Café" },
  { id: "inv2", name: "Leche Entera (L)", unit: "L", quantity: 3, minStock: 10, costPerUnit: 22, category: "Lácteos" },
  { id: "inv3", name: "Leche de Avena (L)", unit: "L", quantity: 18, minStock: 5, costPerUnit: 45, category: "Lácteos" },
  { id: "inv4", name: "Azúcar (kg)", unit: "kg", quantity: 8, minStock: 3, costPerUnit: 20, category: "Básicos" },
  { id: "inv5", name: "Harina (kg)", unit: "kg", quantity: 2, minStock: 5, costPerUnit: 18, category: "Básicos" },
  { id: "inv6", name: "Vasos 12oz (pza)", unit: "pza", quantity: 150, minStock: 50, costPerUnit: 2, category: "Desechables" },
  { id: "inv7", name: "Chocolate en polvo (kg)", unit: "kg", quantity: 4, minStock: 2, costPerUnit: 95, category: "Café" },
];

const mockMovements: StockMovement[] = [
  { id: "m1", itemId: "inv1", itemName: "Café Espresso (kg)", type: "IN", quantity: 5, note: "Compra semanal", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "m2", itemId: "inv2", itemName: "Leche Entera (L)", type: "OUT", quantity: 8, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: "m3", itemId: "inv5", itemName: "Harina (kg)", type: "WASTE", quantity: 1, note: "Caducidad", createdAt: new Date().toISOString() },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"items" | "movements">("items");
  const [movementOpen, setMovementOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movForm, setMovForm] = useState({ type: "IN" as StockMovement["type"], quantity: "", note: "" });
  const [search, setSearch] = useState("");

  const loadData = useCallback(() => {
    setIsLoading(true);
    Promise.allSettled([
      inventoryApi.getItems(),
      inventoryApi.getMovements(),
    ]).then(([itemsRes, movRes]) => {
      setItems(itemsRes.status === "fulfilled" ? itemsRes.value : mockItems);
      setMovements(movRes.status === "fulfilled" ? movRes.value : mockMovements);
    }).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMovement = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await inventoryApi.addMovement({
        inventoryItemId: selectedItem.id,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        note: movForm.note || undefined,
      });
      loadData();
    } catch {
      const delta = movForm.type === "IN" ? Number(movForm.quantity) : -Number(movForm.quantity);
      setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i));
      setMovements((prev) => [{
        id: `m-${Date.now()}`,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        note: movForm.note || undefined,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    } finally {
      setIsSubmitting(false);
      setMovementOpen(false);
      setSelectedItem(null);
      setMovForm({ type: "IN", quantity: "", note: "" });
    }
  };

  const displayItems = items.length > 0 ? items : mockItems;
  const displayMovements = movements.length > 0 ? movements : mockMovements;

  const filteredItems = displayItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockItems = displayItems.filter((i) => i.quantity <= i.minStock);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Control de stock e insumos"
        actions={
          <div className="flex gap-2">
            <Button variant={view === "items" ? "default" : "outline"} size="sm" onClick={() => setView("items")}>
              <Package className="h-4 w-4 mr-2" />Stock
            </Button>
            <Button variant={view === "movements" ? "default" : "outline"} size="sm" onClick={() => setView("movements")}>
              <ArrowUpDown className="h-4 w-4 mr-2" />Movimientos
            </Button>
          </div>
        }
      />

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Stock bajo en {lowStockItems.length} artículo(s)</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {lowStockItems.map((i) => i.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === "items" ? (
        <div className="space-y-4">
          <Input
            placeholder="Buscar artículo o categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isLow = item.quantity <= item.minStock;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={cn(isLow && "text-red-600 font-bold")}>
                          {item.quantity} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.minStock} {item.unit}
                      </TableCell>
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
                          <Plus className="h-3.5 w-3.5 mr-1" />Movimiento
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
                <TableHead>Artículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMovements.map((m) => {
                const cfg = MOVEMENT_LABELS[m.type];
                const Icon = cfg.icon;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.itemName}</TableCell>
                    <TableCell>
                      <span className={cn("flex items-center gap-1 text-sm", cfg.color)}>
                        <Icon className="h-3.5 w-3.5" />{cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.note ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(m.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Movement Dialog */}
      <Dialog open={movementOpen} onOpenChange={(o) => { setMovementOpen(o); if (!o) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="py-2 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Artículo: <span className="text-foreground">{selectedItem.name}</span>
                <br />Stock actual: <span className="font-mono font-bold">{selectedItem.quantity} {selectedItem.unit}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={movForm.type} onValueChange={(v) => setMovForm((f) => ({ ...f, type: v as StockMovement["type"] }))}>
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
                  min={0.01}
                  step={0.01}
                  value={movForm.quantity}
                  onChange={(e) => setMovForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nota</Label>
                <Textarea
                  placeholder="Proveedor, motivo…"
                  value={movForm.note}
                  onChange={(e) => setMovForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovement} disabled={!movForm.quantity || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
