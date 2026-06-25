"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTablesStore } from "@/store/tables.store";
import { useAreasStore } from "@/store/areas.store";
import { useTableLayout } from "@/hooks/useTableLayout";
import { TableCanvas } from "@/components/tables/TableCanvas";
import { LayoutEditor } from "@/components/tables/LayoutEditor";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Settings, RefreshCw, Grid3x3 } from "lucide-react";
import { areasApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import type { RestaurantTable } from "@/types/orders.types";
import { useRealtime } from "@/hooks/useRealtime";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";

export default function TablesPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const { areas, setAreas, selectedAreaId, selectArea } = useAreasStore();
  const { isEditMode, setEditMode, selectedTable, selectTable } = useTablesStore();
  const {
    tables,
    loadTables,
    updateTableLocal,
    saveLayout,
    cancelChanges,
  } = useTableLayout(selectedAreaId || "");

  // Cargar áreas activas
  const { data: areasData, isLoading: areasLoading, refetch: refetchAreas } = useQuery({
    queryKey: ["areas", "active", branchId],
    queryFn: () => areasApi.getActive(branchId),
  });
  const realtimeEvents = useMemo(() => ({
    "table.updated": () => loadTables(),
    "table.status.changed": () => loadTables(),
    "table.layout.updated": () => {
      refetchAreas();
      loadTables();
    },
    "order.created": () => loadTables(),
    "order.completed": () => loadTables(),
    "order.cancelled": () => loadTables(),
  }), [loadTables, refetchAreas]);
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  // Cargar áreas y seleccionar la primera al inicio
  useEffect(() => {
    if (areasData && areasData.length > 0) {
      setAreas(areasData);
      if (!selectedAreaId) {
        selectArea(areasData[0].id);
      }
    }
  }, [areasData, setAreas, selectedAreaId, selectArea]);

  // Cargar mesas cuando cambia el área seleccionada
  useEffect(() => {
    if (selectedAreaId) {
      loadTables();
    }
  }, [selectedAreaId, loadTables]);

  // Manejar guardado de cambios
  const handleSave = async () => {
    const success = await saveLayout();
    if (success) {
      setEditMode(false);
    }
  };

  // Manejar cancelación
  const handleCancel = () => {
    cancelChanges();
    setEditMode(false);
    selectTable(null);
  };

  // Actualizar tabla
  const handleTableUpdate = (id: string, updates: Partial<RestaurantTable>) => {
    updateTableLocal(id, updates);
  };

  // Actualizar múltiples tablas (para el LayoutEditor)
  const handleTablesUpdate = (updatedTables: RestaurantTable[]) => {
    if (!tables) return;
    updatedTables.forEach((table) => {
      const original = tables.find((t) => t.id === table.id);
      if (original) {
        const changes = Object.keys(table).reduce((acc, key) => {
          const k = key as keyof RestaurantTable;
          if (table[k] !== original[k]) {
            acc[k] = table[k] as any;
          }
          return acc;
        }, {} as Partial<RestaurantTable>);

        if (Object.keys(changes).length > 0) {
          updateTableLocal(table.id, changes);
        }
      }
    });
  };

  // Estadísticas rápidas
  const stats = {
    total: tables?.length || 0,
    available: tables?.filter((t) => t.status === "AVAILABLE").length || 0,
    occupied: tables?.filter((t) => t.status === "OCCUPIED").length || 0,
    reserved: tables?.filter((t) => t.status === "RESERVED").length || 0,
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageHeader
            title="Gestión de Mesas"
            description={
              isEditMode
                ? "Modo Diseño - Arrastra y edita las mesas"
                : "Vista operativa del restaurante"
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <RealtimeIndicator status={realtimeStatus} />
          {!isEditMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => loadTables()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Modo Diseño
              </Button>
            </>
          )}
          {isEditMode && (
            <Badge variant="default" className="text-sm py-2 px-3">
              <Grid3x3 className="h-4 w-4 mr-2" />
              Editando Layout
            </Badge>
          )}
        </div>
      </div>

      {/* Estadísticas rápidas */}
      {!isEditMode && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm text-emerald-700">Disponibles</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.available}</p>
          </Card>
          <Card className="p-4 border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-700">Ocupadas</p>
            <p className="text-2xl font-bold text-blue-700">{stats.occupied}</p>
          </Card>
          <Card className="p-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-700">Reservadas</p>
            <p className="text-2xl font-bold text-amber-700">{stats.reserved}</p>
          </Card>
        </div>
      )}

      {/* Tabs por áreas */}
      {areasLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : areas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            No hay áreas configuradas. Crea áreas desde Configuración &gt; Áreas para comenzar.
          </p>
          <Button onClick={() => window.location.href = "/settings/areas"}>
            Ir a Configuración de Áreas
          </Button>
        </Card>
      ) : (
        <Tabs
          value={selectedAreaId || areas[0]?.id}
          onValueChange={selectArea}
          className="flex-1 flex flex-col"
        >
          <TabsList className="w-full justify-start">
            {areas.map((area) => (
              <TabsTrigger
                key={area.id}
                value={area.id}
                style={{
                  borderBottomColor: area.color,
                  borderBottomWidth: selectedAreaId === area.id ? "3px" : "0",
                }}
              >
                {area.name}
                {area._count && area._count.tables > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {area._count.tables}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {areas.map((area) => (
            <TabsContent
              key={area.id}
              value={area.id}
              className="flex-1 border rounded-lg overflow-hidden mt-4"
            >
              {isEditMode ? (
                <LayoutEditor
                  tables={(tables || []).filter((t) => t.areaId === area.id)}
                  onTablesUpdate={handleTablesUpdate}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              ) : (
                <TableCanvas
                  tables={(tables || []).filter((t) => t.areaId === area.id)}
                  isEditMode={false}
                  selectedTableId={selectedTable?.id}
                  onTableSelect={selectTable}
                  onTableUpdate={handleTableUpdate}
                  areaName={area.name}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
