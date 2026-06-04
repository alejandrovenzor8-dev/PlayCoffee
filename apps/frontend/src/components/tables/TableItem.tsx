"use client";

import { Rnd } from "react-rnd";
import { cn } from "@/lib/utils";
import type { RestaurantTable, TableStatus } from "@/types/orders.types";
import { Users, Circle, Square } from "lucide-react";

const STATUS_COLORS: Record<TableStatus, { bg: string; border: string; text: string }> = {
  AVAILABLE: { bg: "bg-emerald-500/10", border: "border-emerald-500", text: "text-emerald-700" },
  OCCUPIED: { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-700" },
  RESERVED: { bg: "bg-amber-500/10", border: "border-amber-500", text: "text-amber-700" },
  MAINTENANCE: { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-700" },
  BLOCKED: { bg: "bg-gray-500/10", border: "border-gray-500", text: "text-gray-600" },
};

interface TableItemProps {
  table: RestaurantTable;
  isEditMode: boolean;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onSizeChange?: (id: string, width: number, height: number) => void;
  onRotationChange?: (id: string, rotation: number) => void;
  onClick?: () => void;
  selected?: boolean;
}

export function TableItem({
  table,
  isEditMode,
  onPositionChange,
  onSizeChange,
  onClick,
  selected = false,
}: TableItemProps) {
  const statusConfig = STATUS_COLORS[table.status];
  const width = table.width || 120;
  const height = table.height || 120;
  const x = table.posX || 0;
  const y = table.posY || 0;
  const rotation = table.rotation || 0;

  const isCircle = table.shape === "circle";
  const isOval = table.shape === "oval";

  // Contenido de la mesa
  const tableContent = (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all",
        "border-2 shadow-lg cursor-pointer",
        statusConfig.bg,
        statusConfig.border,
        isCircle && "rounded-full",
        isOval && "rounded-[50%]",
        !isCircle && !isOval && "rounded-xl",
        selected && "ring-4 ring-blue-400",
        isEditMode && "hover:shadow-xl hover:scale-105"
      )}
      style={{
        backgroundColor: table.color || undefined,
        borderColor: table.color ? table.color : undefined,
      }}
      onClick={onClick}
    >
      {/* Número de mesa */}
      <div className={cn("text-2xl font-bold", statusConfig.text)}>
        {table.number}
      </div>

      {/* Capacidad */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <Users className="h-3 w-3" />
        <span>{table.capacity}</span>
      </div>

      {/* Estado */}
      {!isEditMode && table.status === "OCCUPIED" && (
        <div className="text-[10px] font-semibold mt-1 px-2 py-0.5 bg-blue-500 text-white rounded-full">
          EN USO
        </div>
      )}

      {isEditMode && (
        <div className="absolute top-1 right-1">
          {isCircle ? (
            <Circle className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );

  // En modo edición, usar Rnd para drag & resize
  if (isEditMode) {
    return (
      <Rnd
        size={{ width, height }}
        position={{ x, y }}
        onDragStop={(e, d) => {
          onPositionChange?.(table.id, d.x, d.y);
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onSizeChange?.(table.id, parseInt(ref.style.width), parseInt(ref.style.height));
          onPositionChange?.(table.id, position.x, position.y);
        }}
        minWidth={80}
        minHeight={80}
        maxWidth={300}
        maxHeight={300}
        bounds="parent"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
        className="z-10"
      >
        {tableContent}
      </Rnd>
    );
  }

  // En modo operación, solo visualizar
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {tableContent}
    </div>
  );
}
