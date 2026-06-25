"use client";

import { useEffect, useMemo, useState } from "react";
import { productsApi, type ProductPayload } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import type { Category, PreparationStation, Product } from "@/types/pos.types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChefHat,
  Coffee,
  Edit3,
  Loader2,
  PackagePlus,
  Power,
  Search,
  Trash2,
} from "lucide-react";

type ProductFormState = {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  cost: string;
  imageUrl: string;
  sku: string;
  barcode: string;
  taxRate: string;
  preparationStation: PreparationStation;
  trackInventory: boolean;
  isFeatured: boolean;
  isActive: boolean;
};

const stationLabels: Record<PreparationStation, string> = {
  NONE: "Sin impresion especial",
  KITCHEN: "Cocina",
  BAR: "Barra",
};

const emptyForm: ProductFormState = {
  name: "",
  description: "",
  categoryId: "none",
  price: "",
  cost: "",
  imageUrl: "",
  sku: "",
  barcode: "",
  taxRate: "0",
  preparationStation: "NONE",
  trackInventory: false,
  isFeatured: false,
  isActive: true,
};

function stationBadge(product: Product) {
  if (product.preparationStation === "KITCHEN") {
    return { icon: ChefHat, className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (product.preparationStation === "BAR") {
    return { icon: Coffee, className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  return { icon: null, className: "bg-slate-50 text-slate-600 border-slate-200" };
}

function hasLowStock(product: Product) {
  return (product.inventoryItems ?? []).some(
    (item) => Number(item.currentStock) <= Number(item.minStock),
  );
}

function stockLabel(product: Product) {
  const items = product.inventoryItems ?? [];
  if (items.length === 0) return "Sin inventario";
  const low = items.filter((item) => Number(item.currentStock) <= Number(item.minStock));
  return low.length > 0 ? `${low.length} bajo` : "OK";
}

function toForm(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "none",
    price: String(product.price ?? ""),
    cost: product.cost === undefined || product.cost === null ? "" : String(product.cost),
    imageUrl: product.imageUrl ?? "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    taxRate: String(product.taxRate ?? 0),
    preparationStation: product.preparationStation ?? "NONE",
    trackInventory: product.trackInventory,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
  };
}

function toPayload(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    categoryId: form.categoryId === "none" ? undefined : form.categoryId,
    price: Number(form.price || 0),
    cost: form.cost === "" ? undefined : Number(form.cost),
    imageUrl: form.imageUrl.trim() || undefined,
    sku: form.sku.trim() || undefined,
    barcode: form.barcode.trim() || undefined,
    taxRate: Number(form.taxRate || 0),
    preparationStation: form.preparationStation,
    trackInventory: form.trackInventory,
    isFeatured: form.isFeatured,
    isActive: form.isActive,
  };
}

export default function ProductsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [pendingAction, setPendingAction] = useState<{
    product: Product;
    type: "toggle" | "delete";
  } | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      productsApi.getAll({
        search: search || undefined,
        categoryId: categoryFilter === "all" ? undefined : categoryFilter,
        isActive: activeFilter,
      }),
      productsApi.getCategories(),
    ])
      .then(([nextProducts, nextCategories]) => {
        setProducts(nextProducts);
        setCategories(nextCategories);
      })
      .catch(() => setError("No se pudo cargar el catalogo. Verifica la API."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, activeFilter]);

  const visibleProducts = useMemo(() => {
    if (!search) return products;
    const term = search.toLowerCase();
    return products.filter((product) =>
      [product.name, product.sku, product.barcode, product.category?.name]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [products, search]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm(toForm(product));
    setDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }
    if (Number(form.price || 0) < 0 || Number(form.cost || 0) < 0 || Number(form.taxRate || 0) < 0) {
      setError("Precio, costo e impuestos no pueden ser negativos.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, toPayload(form));
      } else {
        await productsApi.create(toPayload(form));
      }
      setDialogOpen(false);
      loadData();
    } catch {
      setError("No se pudo guardar el producto. Revisa los campos e intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsSaving(true);
    setError(null);
    try {
      if (pendingAction.type === "delete") {
        await productsApi.delete(pendingAction.product.id);
      } else {
        await productsApi.update(pendingAction.product.id, {
          isActive: !pendingAction.product.isActive,
        });
      }
      setPendingAction(null);
      loadData();
    } catch {
      setError("No se pudo completar la accion solicitada.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogo / Productos"
        description="Administra productos, precios y estaciones de preparacion"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadData();
            }}
            placeholder="Buscar por nombre, SKU, codigo o categoria"
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadData}>
          Buscar
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estacion</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : visibleProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No hay productos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              visibleProducts.map((product) => {
                const station = stationBadge(product);
                const StationIcon = station.icon;
                const lowStock = hasLowStock(product);

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-sm font-semibold">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt="" className="h-full w-full rounded-md object-cover" />
                          ) : (
                            product.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.sku ? `SKU ${product.sku}` : "Sin SKU"}
                            {product.modifiers?.length ? ` · ${product.modifiers.length} extras` : ""}
                            {product.trackInventory ? " · inventariable" : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.category?.name ?? "-"}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{formatCurrency(Number(product.price))}</div>
                      {product.cost !== undefined && product.cost !== null && (
                        <div className="text-xs text-muted-foreground">
                          Costo {formatCurrency(Number(product.cost))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1", station.className)}>
                        {StationIcon && <StationIcon className="h-3 w-3" />}
                        {stationLabels[product.preparationStation ?? "NONE"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lowStock ? "destructive" : "secondary"}>
                        {stockLabel(product)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "success" : "secondary"}>
                        {product.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(product)} disabled={!canManage}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingAction({ product, type: "toggle" })}
                          disabled={!canManage}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setPendingAction({ product, type: "delete" })}
                          disabled={!canManage}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Descripcion</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estacion de preparacion</Label>
                <Select
                  value={form.preparationStation}
                  onValueChange={(value: PreparationStation) =>
                    setForm({ ...form, preparationStation: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin impresion especial</SelectItem>
                    <SelectItem value="KITCHEN">Cocina</SelectItem>
                    <SelectItem value="BAR">Barra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Precio</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Costo</Label>
                <Input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Impuesto %</Label>
                <Input type="number" min="0" step="0.01" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Codigo de barras</Label>
                <Input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Imagen URL</Label>
                <Input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isFeatured} onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked })} />
                Destacado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.trackInventory} onCheckedChange={(checked) => setForm({ ...form, trackInventory: checked })} />
                Controlar inventario
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                Activo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete"
                ? "Eliminar producto"
                : pendingAction?.product.isActive
                  ? "Desactivar producto"
                  : "Activar producto"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? "El producto se eliminara con soft delete y dejara de aparecer en POS."
                : "El estado del producto cambiara inmediatamente para POS y comandas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={isSaving}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
