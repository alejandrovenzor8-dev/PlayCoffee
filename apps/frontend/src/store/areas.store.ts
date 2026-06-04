import { create } from "zustand";
import type { TableArea } from "@/types/orders.types";

interface AreasState {
  areas: TableArea[];
  selectedAreaId: string | null;
  isLoading: boolean;

  setAreas: (areas: TableArea[]) => void;
  selectArea: (areaId: string | null) => void;
  addArea: (area: TableArea) => void;
  updateArea: (id: string, updates: Partial<TableArea>) => void;
  removeArea: (id: string) => void;
  reorderAreas: (areas: TableArea[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useAreasStore = create<AreasState>((set) => ({
  areas: [],
  selectedAreaId: null,
  isLoading: false,

  setAreas: (areas) => set({ areas }),
  
  selectArea: (areaId) => set({ selectedAreaId: areaId }),
  
  addArea: (area) =>
    set((state) => ({
      areas: [...state.areas, area].sort((a, b) => a.order - b.order),
    })),
  
  updateArea: (id, updates) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.id === id ? { ...area, ...updates } : area
      ),
    })),
  
  removeArea: (id) =>
    set((state) => ({
      areas: state.areas.filter((area) => area.id !== id),
      selectedAreaId: state.selectedAreaId === id ? null : state.selectedAreaId,
    })),
  
  reorderAreas: (areas) => set({ areas }),
  
  setLoading: (isLoading) => set({ isLoading }),
}));
