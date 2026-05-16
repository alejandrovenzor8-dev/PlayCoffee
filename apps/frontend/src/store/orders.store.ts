import { create } from "zustand";
import type { Order, OrderStatus } from "@/types/orders.types";

interface OrdersState {
  orders: Order[];
  activeOrder: Order | null;
  isLoading: boolean;

  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  setActiveOrder: (order: Order | null) => void;
  setLoading: (loading: boolean) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  activeOrder: null,
  isLoading: false,

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => ({ orders: [order, ...state.orders] })),

  updateOrder: (updated) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === updated.id ? updated : o)),
      activeOrder: state.activeOrder?.id === updated.id ? updated : state.activeOrder,
    })),

  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setLoading: (isLoading) => set({ isLoading }),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    })),
}));
