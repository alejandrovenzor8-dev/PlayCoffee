"use client";

import { Rnd } from "react-rnd";
import { cn, formatCurrency } from "@/lib/utils";
import type { Order, RestaurantTable } from "@/types/orders.types";
import { Clock, Circle, Square, UserRound, Users, Utensils } from "lucide-react";

type VisualStatus = "FREE" | "OCCUPIED" | "PAYMENT_PENDING" | "RESERVED" | "BLOCKED";

const STATUS_COLORS: Record<
  VisualStatus,
  { label: string; bg: string; border: string; text: string; pill: string }
> = {
  FREE: {
    label: "LIBRE",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    pill: "bg-emerald-100 text-emerald-700",
  },
  OCCUPIED: {
    label: "OCUPADA",
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    pill: "bg-blue-100 text-blue-700",
  },
  PAYMENT_PENDING: {
    label: "PENDIENTE DE COBRO",
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    pill: "bg-amber-100 text-amber-700",
  },
  RESERVED: {
    label: "RESERVADA",
    bg: "bg-violet-50",
    border: "border-violet-300",
    text: "text-violet-800",
    pill: "bg-violet-100 text-violet-700",
  },
  BLOCKED: {
    label: "BLOQUEADA",
    bg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-600",
    pill: "bg-slate-200 text-slate-600",
  },
};

function getOpenOrder(table: RestaurantTable) {
  return table.orders?.[0] ?? null;
}

function getVisualStatus(table: RestaurantTable, order: Order | null): VisualStatus {
  if (table.status === "RESERVED") return "RESERVED";
  if (table.status === "AVAILABLE") return "FREE";
  if (table.status === "MAINTENANCE" || table.status === "BLOCKED") return "BLOCKED";
  if (order?.status === "DELIVERED" || order?.status === "READY") return "PAYMENT_PENDING";
  return "OCCUPIED";
}

function elapsedMinutes(order: Order | null) {
  if (!order?.createdAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
}

function itemCount(order: Order | null) {
  return order?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

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
  const openOrder = getOpenOrder(table);
  const visualStatus = getVisualStatus(table, openOrder);
  const statusConfig = STATUS_COLORS[visualStatus];
  const width = table.width || 150;
  const height = table.height || 130;
  const x = table.posX || 0;
  const y = table.posY || 0;
  const rotation = table.rotation || 0;
  const minutes = elapsedMinutes(openOrder);

  const isCircle = table.shape === "circle";
  const isOval = table.shape === "oval";

  const tableContent = (
    <button
      type="button"
      className={cn(
        "flex h-full w-full flex-col justify-between border-2 p-3 text-left shadow-sm transition-all",
        "focus:outline-none focus:ring-4 focus:ring-blue-200",
        statusConfig.bg,
        statusConfig.border,
        isCircle && "rounded-full",
        isOval && "rounded-[50%]",
        !isCircle && !isOval && "rounded-xl",
        selected && "ring-4 ring-blue-300",
        isEditMode ? "cursor-move hover:scale-105 hover:shadow-xl" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={{
        backgroundColor: table.color || undefined,
        borderColor: table.color ? table.color : undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={cn("text-2xl font-bold leading-none", statusConfig.text)}>
            {table.number}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            {table.area?.name ?? "Area"}
          </div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusConfig.pill)}>
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {table.capacity} pax
          </span>
          <span className="font-semibold text-slate-900">
            {openOrder ? formatCurrency(Number(openOrder.total)) : formatCurrency(0)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {minutes === null ? "0 min" : `${minutes} min`}
          </span>
          <span className="flex items-center gap-1">
            <Utensils className="h-3.5 w-3.5" />
            {itemCount(openOrder)} productos
          </span>
        </div>
        <div className="flex items-center gap-1 truncate">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {openOrder?.user
              ? `${openOrder.user.firstName} ${openOrder.user.lastName}`
              : "Sin mesero"}
          </span>
        </div>
      </div>

      {isEditMode && (
        <div className="absolute right-1 top-1">
          {isCircle ? (
            <Circle className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      )}
    </button>
  );

  if (isEditMode) {
    return (
      <Rnd
        size={{ width, height }}
        position={{ x, y }}
        onDragStop={(event, data) => {
          onPositionChange?.(table.id, data.x, data.y);
        }}
        onResizeStop={(event, direction, ref, delta, position) => {
          onSizeChange?.(table.id, parseInt(ref.style.width), parseInt(ref.style.height));
          onPositionChange?.(table.id, position.x, position.y);
        }}
        minWidth={110}
        minHeight={100}
        maxWidth={320}
        maxHeight={260}
        bounds="parent"
        enableResizing
        style={{ transform: `rotate(${rotation}deg)` }}
        className="z-10"
      >
        {tableContent}
      </Rnd>
    );
  }

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
