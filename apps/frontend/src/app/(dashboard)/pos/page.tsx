"use client";

import { useEffect, useState } from "react";
import { productsApi, ordersApi, paymentsApi, tablesApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import type { Product, Category } from "@/types/pos.types";
import type { RestaurantTable } from "@/types/orders.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart, Trash2, Plus, Minus, Search, CreditCard, Banknote, X, Loader2, Table2,
  ArrowRightLeft,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
type PaymentSummary = {
  orderId: string;
  total: number;
  totalPaid: number;
  remainingAmount: number;
  changeAmount: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
};
type PosPayment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  receivedAmount: number | null;
  changeAmount: number;
  reference: string | null;
};
type PosOrder = {
  id: string;
  orderNumber: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [reference, setReference] = useState("");
  const [currentOrder, setCurrentOrder] = useState<PosOrder | null>(null);
  const [payments, setPayments] = useState<PosPayment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cart = useCartStore();
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      productsApi.getAll(),
      productsApi.getCategories(),
      tablesApi.getAll(branchId),
    ])
      .then(([prods, cats, restaurantTables]) => {
        setProducts(prods);
        setCategories(cats);
        setTables(restaurantTables);
      })
      .catch(() => {
        setLoadError("No se pudieron cargar productos, categorias o mesas. Verifica que la API este disponible.");
        setCategories([]);
        setProducts([]);
        setTables([]);
      })
      .finally(() => setIsLoading(false));
  }, [branchId]);

  const availableTables = tables.filter((table) =>
    ["AVAILABLE", "RESERVED"].includes(table.status)
  );

  const selectedTable = tables.find((table) => table.id === cart.tableId);
  const cartTotal = cart.total();
  const paidAmount = paymentSummary?.totalPaid ?? 0;
  const remainingAmount = paymentSummary?.remainingAmount ?? cartTotal;
  const cashReceived = Number(receivedAmount || 0);
  const cashChange =
    paymentMethod === "CASH" ? Math.max(0, cashReceived - remainingAmount) : 0;

  const filtered = products.filter((p) => {
    const matchCat = !selectedCategory || p.categoryId === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const ensureOrder = async () => {
    if (cart.items.length === 0) return;
    if (currentOrder) return currentOrder;

    const orderData = {
      branchId,
      tableId: cart.tableId,
      notes: cart.notes,
      items: cart.items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        notes: i.notes,
        modifiers: i.selectedModifiers.map((m) => ({
          modifierId: m.modifier.id,
          quantity: m.quantity,
        })),
      })),
    };

    const order = await ordersApi.create(orderData);
    const nextOrder = { id: order.id, orderNumber: order.orderNumber };
    setCurrentOrder(nextOrder);
    setPaymentSummary({
      orderId: order.id,
      total: cartTotal,
      totalPaid: 0,
      remainingAmount: cartTotal,
      changeAmount: 0,
      paymentStatus: "UNPAID",
    });
    return nextOrder;
  };

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setReceivedAmount("");
    setReference("");
    setPaymentError(null);
  };

  const handleAddPayment = async () => {
    if (cart.items.length === 0 || remainingAmount <= 0) return;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const order = await ensureOrder();
      if (!order) return;

      const numericAmount =
        paymentMethod === "CASH"
          ? Number(receivedAmount || paymentAmount)
          : Number(paymentAmount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setPaymentError("Ingresa un monto mayor a cero.");
        return;
      }

      if (paymentMethod !== "CASH" && numericAmount > remainingAmount) {
        setPaymentError("El monto no puede exceder el saldo pendiente.");
        return;
      }

      const appliedAmount =
        paymentMethod === "CASH"
          ? Math.min(numericAmount, remainingAmount)
          : numericAmount;

      const response = await paymentsApi.create({
        orderId: order.id,
        method: paymentMethod,
        amount: appliedAmount,
        receivedAmount: paymentMethod === "CASH" ? numericAmount : undefined,
        reference: paymentMethod === "CASH" ? undefined : reference || undefined,
      });

      setPayments((current) => [...current, response.payment]);
      setPaymentSummary(response.summary);
      resetPaymentForm();

      if (response.summary.paymentStatus !== "PAID") return;

      setTables((currentTables) =>
        currentTables.map((table) =>
          table.id === cart.tableId ? { ...table, status: "AVAILABLE" } : table
        )
      );

      cart.clearCart();
      setCurrentOrder(null);
      setPayments([]);
      setPaymentSummary(null);
      setPaymentOpen(false);
      setSuccessMsg(`Orden ${order.orderNumber} pagada correctamente`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setPaymentError("No se pudo registrar el pago. Revisa el saldo, la caja y la orden.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 -m-6 p-6">
      {/* Product panel */}
      <div className="flex flex-1 flex-col min-w-0">
        <PageHeader title="Caja / POS" description="Registra órdenes y procesa pagos" />

        {successMsg && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {successMsg}
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Product grid */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay productos disponibles porque la carga inicial fallo.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay productos para los filtros seleccionados.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => cart.addItem(product)}
                className="group relative flex flex-col rounded-xl border bg-card p-4 text-left transition-all hover:border-blue-400 hover:shadow-md active:scale-95"
              >
                {product.isFeatured && (
                  <Badge variant="default" className="absolute top-2 right-2 text-xs h-5">
                    Popular
                  </Badge>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-2xl mb-3">
                  ☕
                </div>
                <p className="font-medium text-sm leading-tight">{product.name}</p>
                <p className="mt-1 text-lg font-bold text-blue-600">
                  {formatCurrency(product.price)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="flex w-80 flex-col rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="font-semibold text-sm">Carrito</span>
          </div>
          <Badge variant="secondary">{cart.itemCount()} items</Badge>
        </div>

        <div className="border-b p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Table2 className="h-4 w-4" />
            Mesa
          </div>
          <Select
            value={cart.tableId ?? "takeaway"}
            onValueChange={(value) => cart.setTableId(value === "takeaway" ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar mesa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="takeaway">Sin mesa / para llevar</SelectItem>
              {availableTables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  Mesa {table.number}
                  {table.area?.name ? ` - ${table.area.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTable && (
            <p className="text-xs text-muted-foreground">
              Capacidad: {selectedTable.capacity} personas
            </p>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
              <ShoppingCart className="h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm">Carrito vacío</p>
              <p className="text-xs opacity-70 mt-1">Selecciona productos</p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.unitPrice)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                    className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                  <button
                    onClick={() => cart.removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cart.subtotal())}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="text-blue-600 text-lg">{formatCurrency(cart.total())}</span>
          </div>

          <Button
            className="w-full"
            disabled={cart.items.length === 0}
            onClick={() => {
              resetPaymentForm();
              setPaymentOpen(true);
            }}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Cobrar {cart.items.length > 0 ? formatCurrency(cart.total()) : ""}
          </Button>

          {cart.items.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={cart.clearCart}>
              <Trash2 className="h-3 w-3 mr-1" />
              Limpiar carrito
            </Button>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          if (!open && paymentSummary?.paymentStatus === "PARTIALLY_PAID") return;
          setPaymentOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pagos del ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-4xl font-bold mt-1 text-blue-600">{formatCurrency(cartTotal)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(remainingAmount)}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "CARD", "TRANSFER"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-medium text-sm transition-all ${
                      paymentMethod === method
                        ? "border-blue-600 bg-blue-50 text-blue-600"
                        : "hover:bg-muted"
                    }`}
                  >
                    {method === "CASH" ? (
                      <Banknote className="h-4 w-4" />
                    ) : method === "CARD" ? (
                      <CreditCard className="h-4 w-4" />
                    ) : (
                      <ArrowRightLeft className="h-4 w-4" />
                    )}
                    {paymentLabels[method]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethod === "CASH" ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Efectivo recibido</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receivedAmount}
                    onChange={(event) => setReceivedAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-medium">Monto a aplicar</p>
                  <Input
                    type="number"
                    min="0"
                    max={remainingAmount}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder={remainingAmount.toFixed(2)}
                  />
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-medium">
                  {paymentMethod === "CASH" ? "Cambio" : "Referencia"}
                </p>
                {paymentMethod === "CASH" ? (
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-semibold">
                    {formatCurrency(cashChange)}
                  </div>
                ) : (
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Opcional"
                  />
                )}
              </div>
            </div>

            {paymentError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {paymentError}
              </div>
            )}

            {payments.length > 0 && (
              <div className="rounded-lg border">
                <div className="border-b px-3 py-2 text-sm font-medium">Pagos aplicados</div>
                <div className="max-h-40 overflow-y-auto divide-y">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{paymentLabels[payment.method]}</p>
                        {payment.reference && (
                          <p className="text-xs text-muted-foreground">{payment.reference}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                        {payment.changeAmount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Cambio {formatCurrency(payment.changeAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentOpen(false)}
              disabled={isProcessing || paymentSummary?.paymentStatus === "PARTIALLY_PAID"}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddPayment} disabled={isProcessing || remainingAmount <= 0}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</>
              ) : (
                <>Agregar Pago</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
