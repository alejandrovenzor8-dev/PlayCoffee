"use client";

import { useEffect, useState } from "react";
import { useTablesStore } from "@/store/tables.store";
import { useTableLayout } from "@/hooks/useTableLayout";
import { TableCanvas } from "@/components/tables/TableCanvas";
import { LayoutEditor } from "@/components/tables/LayoutEditor";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Settings,
  RefreshCw,
  Grid3x3,
} from "lucide-react";
import type { RestaurantTable, TableArea } from "@/types/orders.types";

// Mock areas - En producción vendría del backend
const mockAreas: TableArea[] = [
  {
    id: "area-1",
    branchId: "branch-1",
    name: "Planta Baja",
    tables: [],
  },
  {
    id: "area-2",
    branchId: "branch-1",
    name: "Terraza",
    tables: [],
  },
  {
    id: "area-3",
    branchId: "branch-1",
    name: "Área Infantil",
    tables: [],
  },
];

export default function TablesPage() {
  const [selectedAreaId, setSelectedAreaId] = useState<string>(mockAreas[0]?.id || "");
  const { isEditMode, setEditMode, setAreas, selectedTable, selectTable } = useTablesStore();
  const {
    tables,
    loadTables,
    updateTableLocal,
    saveLayout,
    cancelChanges,
  } = useTableLayout(selectedAreaId);

  // Cargar áreas y mesas inicialmente
  useEffect(() => {
    setAreas(mockAreas);
    if (selectedAreaId) {
      loadTables();
    }
  }, [selectedAreaId, setAreas, loadTables]);

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
      <Tabs value={selectedAreaId} onValueChange={setSelectedAreaId} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          {mockAreas.map((area) => (
            <TabsTrigger key={area.id} value={area.id}>
              {area.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {mockAreas.map((area) => (
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
    </div>
  );
}
