import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SelectedOrder = { orderId: string; userId: string; branchId: string };

export const usePosSessionStore = create<{
  selectedOrder: SelectedOrder | null;
  selectOrder: (order: SelectedOrder) => void;
  clearOrder: () => void;
}>()(
  persist(
    (set) => ({
      selectedOrder: null,
      selectOrder: (selectedOrder) => set({ selectedOrder }),
      clearOrder: () => set({ selectedOrder: null }),
    }),
    {
      name: "playcoffee-pos-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ selectedOrder }) => ({ selectedOrder }),
    },
  ),
);
