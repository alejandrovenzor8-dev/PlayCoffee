"use client";

import { useRef } from "react";
import { TableItem } from "./TableItem";
import type { RestaurantTable } from "@/types/orders.types";
import { cn } from "@/lib/utils";

interface TableCanvasProps {
  tables: RestaurantTable[];
  isEditMode: boolean;
  selectedTableId?: string | null;
  onTableSelect?: (table: RestaurantTable) => void;
  onTableUpdate?: (id: string, updates: Partial<RestaurantTable>) => void;
  areaName?: string;
}

export function TableCanvas({
  tables,
  isEditMode,
  selectedTableId,
  onTableSelect,
  onTableUpdate,
  areaName,
}: TableCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handlePositionChange = (id: string, x: number, y: number) => {
    onTableUpdate?.(id, { posX: x, posY: y });
  };

  const handleSizeChange = (id: string, width: number, height: number) => {
    onTableUpdate?.(id, { width, height });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {areaName && (
        <div className="px-4 py-3 border-b bg-muted/50">
          <h3 className="font-semibold text-lg">{areaName}</h3>
          <p className="text-sm text-muted-foreground">
            {tables.length} mesa{tables.length !== 1 ? "s" : ""}
            {isEditMode && " • Modo Diseño"}
          </p>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={cn(
          "relative flex-1 overflow-auto",
          "bg-gradient-to-br from-slate-50 to-slate-100",
          isEditMode && "bg-grid-pattern"
        )}
        style={{
          minHeight: "600px",
          backgroundImage: isEditMode
            ? "radial-gradient(circle, #94a3b8 1px, transparent 1px)"
            : undefined,
          backgroundSize: isEditMode ? "20px 20px" : undefined,
        }}
      >
        {/* Grid visual solo en modo edición */}
        {isEditMode && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-dashed border-slate-300/50 rounded-lg m-4" />
          </div>
        )}

        {/* Mesas */}
        {tables.map((table) => (
          <TableItem
            key={table.id}
            table={table}
            isEditMode={isEditMode}
            selected={selectedTableId === table.id}
            onClick={() => onTableSelect?.(table)}
            onPositionChange={handlePositionChange}
            onSizeChange={handleSizeChange}
          />
        ))}

        {/* Mensaje cuando no hay mesas */}
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">No hay mesas en esta área</p>
              {isEditMode && (
                <p className="text-sm mt-2">
                  Crea una mesa nueva para comenzar
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
