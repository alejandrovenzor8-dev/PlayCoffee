"use client";

import { useState, useCallback } from "react";
import { tablesApi } from "@/lib/api";
import { useTablesStore } from "@/store/tables.store";
import type { RestaurantTable } from "@/types/orders.types";
import { toast } from "@/components/ui/use-toast";

export function useTableLayout(areaId: string) {
  const {
    tables,
    setTables,
    updateTable,
    setLoading,
    setHasUnsavedChanges,
    resetChanges,
  } = useTablesStore();

  const [localTables, setLocalTables] = useState<RestaurantTable[]>([]);

  // Cargar mesas del área
  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const tables = await tablesApi.getByArea(areaId);
      setTables(tables);
      setLocalTables(tables);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las mesas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [areaId, setTables, setLoading]);

  // Actualizar mesa localmente (sin guardar)
  const updateTableLocal = useCallback(
    (tableId: string, updates: Partial<RestaurantTable>) => {
      setLocalTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, ...updates } : t))
      );
      setHasUnsavedChanges(true);
    },
    [setHasUnsavedChanges]
  );

  // Guardar todos los cambios
  const saveLayout = useCallback(async () => {
    setLoading(true);
    try {
      // Guardar cada mesa modificada
      const updates = localTables.map(async (table) => {
        const { id, number, capacity, posX, posY, width, height, rotation, shape, color, status } = table;
        
        return tablesApi.update(id, {
          number,
          capacity,
          posX,
          posY,
          width,
          height,
          rotation,
          shape,
          color,
          status,
        });
      });

      await Promise.all(updates);

      setTables(localTables);
      resetChanges();

      toast({
        title: "¡Guardado!",
        description: "El layout de mesas se actualizó correctamente",
      });

      return true;
    } catch (error) {
      console.error("Error saving layout:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el layout",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [localTables, setTables, setLoading, resetChanges]);

  // Cancelar cambios
  const cancelChanges = useCallback(() => {
    setLocalTables(tables || []);
    resetChanges();
  }, [tables, resetChanges]);

  // Crear nueva mesa
  const createTable = useCallback(
    async (tableData: Partial<RestaurantTable>) => {
      setLoading(true);
      try {
        const newTable = await tablesApi.create({
          areaId,
          ...tableData,
        } as any);

        setLocalTables((prev) => [...prev, newTable]);
        setTables([...(tables || []), newTable]);

        toast({
          title: "Mesa creada",
          description: `Mesa ${newTable.number} creada exitosamente`,
        });

        return newTable;
      } catch (error) {
        console.error("Error creating table:", error);
        toast({
          title: "Error",
          description: "No se pudo crear la mesa",
          variant: "destructive",
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [areaId, tables, setTables, setLoading]
  );

  // Eliminar mesa
  const deleteTable = useCallback(
    async (tableId: string) => {
      setLoading(true);
      try {
        await tablesApi.delete(tableId);

        const updated = localTables.filter((t) => t.id !== tableId);
        setLocalTables(updated);
        setTables((tables || []).filter((t) => t.id !== tableId));

        toast({
          title: "Mesa eliminada",
          description: "La mesa se eliminó correctamente",
        });

        return true;
      } catch (error) {
        console.error("Error deleting table:", error);
        toast({
          title: "Error",
          description: "No se pudo eliminar la mesa",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [localTables, tables, setTables, setLoading]
  );

  return {
    tables: localTables,
    loadTables,
    updateTableLocal,
    saveLayout,
    cancelChanges,
    createTable,
    deleteTable,
  };
}
