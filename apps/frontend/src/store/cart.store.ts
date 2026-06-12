import { create } from "zustand";
import type { CartItem, Product, Modifier } from "@/types/pos.types";

interface CartState {
  items: CartItem[];
  tableId?: string;
  notes?: string;

  addItem: (product: Product, modifiers?: Array<{ modifier: Modifier; quantity: number }>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  setTableId: (tableId: string | undefined) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;

  // Computed
  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
}

function computeItemPrice(
  product: Product,
  modifiers: Array<{ modifier: Modifier; quantity: number }>,
  quantity: number
): number {
  const productPrice = Number(product.price);
  const modifiersTotal = modifiers.reduce(
    (sum, m) => sum + Number(m.modifier.price) * m.quantity,
    0
  );
  return (productPrice + modifiersTotal) * quantity;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  tableId: undefined,
  notes: undefined,

  addItem: (product, modifiers = []) => {
    set((state) => {
      const existing = state.items.find(
        (i) => i.product.id === product.id && i.selectedModifiers.length === 0 && modifiers.length === 0
      );

      if (existing && modifiers.length === 0) {
        return {
          items: state.items.map((i) =>
            i.id === existing.id
              ? {
                  ...i,
                  quantity: i.quantity + 1,
                  totalPrice: computeItemPrice(product, modifiers, i.quantity + 1),
                }
              : i
          ),
        };
      }

      const newItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity: 1,
        unitPrice: Number(product.price),
        totalPrice: computeItemPrice(product, modifiers, 1),
        selectedModifiers: modifiers,
      };

      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (itemId) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) })),

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity,
              totalPrice: computeItemPrice(i.product, i.selectedModifiers, quantity),
            }
          : i
      ),
    }));
  },

  updateNotes: (itemId, notes) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === itemId ? { ...i, notes } : i)),
    })),

  setTableId: (tableId) => set({ tableId }),
  setNotes: (notes) => set({ notes }),

  clearCart: () => set({ items: [], tableId: undefined, notes: undefined }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.totalPrice, 0),
  total: () => get().subtotal(),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
