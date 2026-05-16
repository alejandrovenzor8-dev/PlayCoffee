import { create } from "zustand";
import type { RestaurantTable, TableArea, TableStatus } from "@/types/orders.types";

interface TablesState {
  tables: RestaurantTable[];
  areas: TableArea[];
  selectedTable: RestaurantTable | null;
  isLoading: boolean;

  setTables: (tables: RestaurantTable[]) => void;
  setAreas: (areas: TableArea[]) => void;
  selectTable: (table: RestaurantTable | null) => void;
  updateTableStatus: (tableId: string, status: TableStatus) => void;
  setLoading: (loading: boolean) => void;
}

export const useTablesStore = create<TablesState>((set) => ({
  tables: [],
  areas: [],
  selectedTable: null,
  isLoading: false,

  setTables: (tables) => set({ tables }),
  setAreas: (areas) => set({ areas }),
  selectTable: (selectedTable) => set({ selectedTable }),
  setLoading: (isLoading) => set({ isLoading }),

  updateTableStatus: (tableId, status) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, status } : t
      ),
    })),
}));
