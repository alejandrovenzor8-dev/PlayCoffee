"use client";

import { useEffect, useState, useCallback } from "react";
import { productsApi, ordersApi, paymentsApi } from "@/lib/api";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { formatCurrency } from "@/lib/utils";
import type { Product, Category } from "@/types/pos.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart, Trash2, Plus, Minus, Search, CreditCard, Banknote, X, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cart = useCartStore();
  const { user } = useAuthStore();

  useEffect(() => {
    Promise.all([productsApi.getAll(), productsApi.getCategories()])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats);
      })
      .catch(() => {
        // Mock data for demo
        setCategories([
          { id: "1", name: "Bebidas", description: "", color: "#2563eb", sortOrder: 0, isActive: true },
          { id: "2", name: "Alimentos", description: "", color: "#059669", sortOrder: 1, isActive: true },
          { id: "3", name: "Postres", description: "", color: "#d97706", sortOrder: 2, isActive: true },
        ]);
        setProducts([
          { id: "p1", categoryId: "1", name: "Cappuccino", price: 65, taxRate: 0, isActive: true, isFeatured: true },
          { id: "p2", categoryId: "1", name: "Latte", price: 70, taxRate: 0, isActive: true, isFeatured: false },
          { id: "p3", categoryId: "1", name: "Americano", price: 45, taxRate: 0, isActive: true, isFeatured: false },
          { id: "p4", categoryId: "1", name: "Matcha Latte", price: 85, taxRate: 0, isActive: true, isFeatured: true },
          { id: "p5", categoryId: "2", name: "Avocado Toast", price: 110, taxRate: 0, isActive: true, isFeatured: false },
          { id: "p6", categoryId: "2", name: "Waffle", price: 95, taxRate: 0, isActive: true, isFeatured: false },
          { id: "p7", categoryId: "3", name: "Cheesecake", price: 75, taxRate: 0, isActive: true, isFeatured: false },
          { id: "p8", categoryId: "3", name: "Brownie", price: 60, taxRate: 0, isActive: true, isFeatured: false },
        ] as Product[]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    const matchCat = !selectedCategory || p.categoryId === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return;
    setIsProcessing(true);
    try {
      const orderData = {
        branchId: user?.branchId ?? "demo-branch",
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

      // Process payment
      await paymentsApi.create({
        orderId: order.id,
        method: paymentMethod,
        amount: cart.total(),
      });

      cart.clearCart();
      setPaymentOpen(false);
      setSuccessMsg(`Orden ${order.orderNumber} procesada correctamente`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
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
            onClick={() => setPaymentOpen(true)}
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
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Procesar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Total a cobrar</p>
              <p className="text-4xl font-bold mt-1 text-blue-600">{formatCurrency(cart.total())}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {(["CASH", "CARD"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 font-medium text-sm transition-all ${
                      paymentMethod === method
                        ? "border-blue-600 bg-blue-50 text-blue-600"
                        : "hover:bg-muted"
                    }`}
                  >
                    {method === "CASH" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    {method === "CASH" ? "Efectivo" : "Tarjeta"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePlaceOrder} disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
              ) : (
                <>Confirmar Pago</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
