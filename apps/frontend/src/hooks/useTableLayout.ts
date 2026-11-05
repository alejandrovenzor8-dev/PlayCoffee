"use client";

import { useState, useCallback, useRef } from "react";
import { getApiErrorMessage, tablesApi } from "@/lib/api";
import { useTablesStore } from "@/store/tables.store";
import type { RestaurantTable } from "@/types/orders.types";

export function useTableLayout(areaId: string) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const original = useRef<RestaurantTable[]>([]);
  const requestVersion = useRef(0);
  const loadedArea = useRef("");
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setHasUnsavedChanges = useTablesStore((state) => state.setHasUnsavedChanges);

  const loadTables = useCallback(async () => {
    const version = ++requestVersion.current;
    if (loadedArea.current !== areaId) {
      loadedArea.current = areaId;
      setTables([]);
      original.current = [];
    }
    if (!areaId) { setTables([]); original.current = []; return; }
    setIsLoading(true);
    try {
      const next = await tablesApi.getByArea(areaId);
      if (version !== requestVersion.current || useTablesStore.getState().hasUnsavedChanges) return;
      original.current = next;
      setTables(next);
      setError(null);
    } catch (err) {
      if (version === requestVersion.current) setError(getApiErrorMessage(err, "No se pudieron cargar las mesas."));
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [areaId]);

  const replaceTablesLocal = useCallback((next: RestaurantTable[]) => {
    setTables(next);
    setHasUnsavedChanges(true);
    setError(null);
  }, [setHasUnsavedChanges]);

  const updateTableLocal = useCallback((id: string, updates: Partial<RestaurantTable>) => {
    setTables((previous) => previous.map((table) => table.id === id ? { ...table, ...updates } : table));
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  const saveLayout = useCallback(async () => {
    if (saving.current) return false;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const next: RestaurantTable[] = await tablesApi.saveLayout({
        areaId,
        tables: tables.map((table) => ({
          ...(table.id.startsWith("temp-") ? {} : { id: table.id }),
          areaId, number: table.number, capacity: table.capacity,
          posX: table.posX, posY: table.posY, width: table.width, height: table.height,
          rotation: table.rotation, shape: table.shape, color: table.color ?? "",
        })),
        deletedIds: original.current.filter((table) => !tables.some((entry) => entry.id === table.id)).map((table) => table.id),
      });
      original.current = next;
      setTables(next);
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar el plano. Tus cambios siguen disponibles para reintentar."));
      return false;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }, [areaId, tables, setHasUnsavedChanges]);

  const cancelChanges = useCallback(() => {
    setTables(original.current);
    setHasUnsavedChanges(false);
    setError(null);
  }, [setHasUnsavedChanges]);

  return { tables, loadTables, updateTableLocal, replaceTablesLocal, saveLayout, cancelChanges, isSaving, isLoading, error };
}
