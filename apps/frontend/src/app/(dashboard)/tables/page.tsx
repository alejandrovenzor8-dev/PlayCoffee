"use client";

import { useEffect, useState } from "react";
import { tablesApi } from "@/lib/api";
import { useTablesStore } from "@/store/tables.store";
import { formatCurrency, cn } from "@/lib/utils";
import type { RestaurantTable, TableArea, TableStatus } from "@/types/orders.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Users, RefreshCw, Circle } from "lucide-react";

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; border: string; text: string }> = {
  AVAILABLE: { label: "Disponible", bg: "bg-emerald-500/10", border: "border-emerald-500/50", text: "text-emerald-600" },
  OCCUPIED: { label: "Ocupada", bg: "bg-blue-500/10", border: "border-blue-500/50", text: "text-blue-600" },
  RESERVED: { label: "Reservada", bg: "bg-amber-500/10", border: "border-amber-500/50", text: "text-amber-600" },
  MAINTENANCE: { label: "Mantenimiento", bg: "bg-red-500/10", border: "border-red-500/50", text: "text-red-600" },
  BLOCKED: { label: "Bloqueada", bg: "bg-gray-500/10", border: "border-gray-500/50", text: "text-gray-500" },
};

const mockAreas: TableArea[] = [
  {
    id: "a1", branchId: "b1", name: "Planta Baja",
    tables: [
      { id: "t1", areaId: "a1", number: "1", capacity: 4, status: "AVAILABLE", posX: 1, posY: 1, shape: "rect", isActive: true },
      { id: "t2", areaId: "a1", number: "2", capacity: 2, status: "OCCUPIED", posX: 2, posY: 1, shape: "circle", isActive: true },
      { id: "t3", areaId: "a1", number: "3", capacity: 6, status: "RESERVED", posX: 3, posY: 1, shape: "rect", isActive: true },
      { id: "t4", areaId: "a1", number: "4", capacity: 4, status: "AVAILABLE", posX: 1, posY: 2, shape: "rect", isActive: true },
      { id: "t5", areaId: "a1", number: "5", capacity: 4, status: "OCCUPIED", posX: 2, posY: 2, shape: "rect", isActive: true },
      { id: "t6", areaId: "a1", number: "6", capacity: 2, status: "AVAILABLE", posX: 3, posY: 2, shape: "circle", isActive: true },
    ],
  },
  {
    id: "a2", branchId: "b1", name: "Terraza",
    tables: [
      { id: "t7", areaId: "a2", number: "T1", capacity: 4, status: "AVAILABLE", posX: 1, posY: 1, shape: "rect", isActive: true },
      { id: "t8", areaId: "a2", number: "T2", capacity: 4, status: "OCCUPIED", posX: 2, posY: 1, shape: "rect", isActive: true },
      { id: "t9", areaId: "a2", number: "T3", capacity: 2, status: "AVAILABLE", posX: 3, posY: 1, shape: "circle", isActive: true },
    ],
  },
];

function TableCard({ table, onStatusChange }: { table: RestaurantTable; onStatusChange: (id: string, status: TableStatus) => void }) {
  const config = STATUS_CONFIG[table.status];
  const isOccupied = table.status === "OCCUPIED";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md select-none",
        config.bg, config.border
      )}
    >
      {/* Shape indicator */}
      {table.shape === "circle" ? (
        <div className="absolute top-2 right-2">
          <Circle className="h-3 w-3 text-muted-foreground opacity-50" />
        </div>
      ) : null}

      <div className="mb-2">
        <p className={cn("text-2xl font-bold", config.text)}>Mesa {table.number}</p>
        <Badge variant="outline" className={cn("mt-1 text-xs", config.text, config.border)}>
          {config.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
        <Users className="h-3 w-3" />
        <span>{table.capacity} personas</span>
      </div>

      {isOccupied && (
        <div className="mt-2 pt-2 border-t border-current/20">
          <p className="text-xs text-blue-600 font-medium">En servicio</p>
        </div>
      )}

      {/* Quick status change */}
      <div className="mt-2 flex gap-1.5 flex-wrap">
        {(["AVAILABLE", "OCCUPIED", "RESERVED"] as TableStatus[]).map((s) => (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onStatusChange(table.id, s); }}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border transition-all",
              table.status === s
                ? STATUS_CONFIG[s].bg + " " + STATUS_CONFIG[s].border + " " + STATUS_CONFIG[s].text
                : "hover:bg-muted"
            )}
          >
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TablesPage() {
  const { areas, setAreas, updateTableStatus, isLoading, setLoading } = useTablesStore();

  useEffect(() => {
    setLoading(true);
    tablesApi.getAreas()
      .then(setAreas)
      .catch(() => setAreas(mockAreas))
      .finally(() => setLoading(false));
  }, [setAreas, setLoading]);

  const handleStatusChange = async (tableId: string, status: TableStatus) => {
    try {
      await tablesApi.updateStatus(tableId, status);
    } catch { /* optimistic update still applied */ }
    updateTableStatus(tableId, status);
  };

  const displayAreas = areas.length > 0 ? areas : mockAreas;

  const allTables = displayAreas.flatMap((a) => a.tables);
  const stats = {
    available: allTables.filter((t) => t.status === "AVAILABLE").length,
    occupied: allTables.filter((t) => t.status === "OCCUPIED").length,
    reserved: allTables.filter((t) => t.status === "RESERVED").length,
    total: allTables.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapa de Mesas"
        description="Vista visual del estado de las mesas"
        actions={
          <Button variant="outline" size="sm" onClick={() => tablesApi.getAreas().then(setAreas).catch(() => {})}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        }
      />

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Disponibles", count: stats.available, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { label: "Ocupadas", count: stats.occupied, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Reservadas", count: stats.reserved, color: "text-amber-600 bg-amber-50 border-amber-200" },
          { label: "Total", count: stats.total, color: "text-gray-600 bg-gray-50 border-gray-200" },
        ].map(({ label, count, color }) => (
          <div key={label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium", color)}>
            <span className="text-lg font-bold">{count}</span>
            <span className="opacity-80">{label}</span>
          </div>
        ))}
      </div>

      {/* Areas / Tabs */}
      <Tabs defaultValue={displayAreas[0]?.id}>
        <TabsList>
          {displayAreas.map((area) => (
            <TabsTrigger key={area.id} value={area.id}>
              {area.name} ({area.tables.length})
            </TabsTrigger>
          ))}
        </TabsList>

        {displayAreas.map((area) => (
          <TabsContent key={area.id} value={area.id} className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {area.tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
