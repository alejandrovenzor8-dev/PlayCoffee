import { create } from "zustand";
import type { RestaurantTable, TableArea, TableStatus } from "@/types/orders.types";

interface TablesState {
  tables: RestaurantTable[];
  areas: TableArea[];
  selectedTable: RestaurantTable | null;
  isLoading: boolean;
  isEditMode: boolean;
  hasUnsavedChanges: boolean;

  setTables: (tables: RestaurantTable[]) => void;
  setAreas: (areas: TableArea[]) => void;
  selectTable: (table: RestaurantTable | null) => void;
  updateTableStatus: (tableId: string, status: TableStatus) => void;
  updateTable: (tableId: string, updates: Partial<RestaurantTable>) => void;
  setLoading: (loading: boolean) => void;
  setEditMode: (mode: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  resetChanges: () => void;
}

export const useTablesStore = create<TablesState>((set) => ({
  tables: [],
  areas: [],
  selectedTable: null,
  isLoading: false,
  isEditMode: false,
  hasUnsavedChanges: false,

  setTables: (tables) => set({ tables }),
  setAreas: (areas) => set({ areas }),
  selectTable: (selectedTable) => set({ selectedTable }),
  setLoading: (isLoading) => set({ isLoading }),
  setEditMode: (isEditMode) => set({ isEditMode }),
  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),

  updateTableStatus: (tableId, status) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, status } : t
      ),
    })),

  updateTable: (tableId, updates) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, ...updates } : t
      ),
      hasUnsavedChanges: true,
    })),

  resetChanges: () => set({ hasUnsavedChanges: false }),
}));
