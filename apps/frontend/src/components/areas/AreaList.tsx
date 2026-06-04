"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GripVertical,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";
import type { TableArea } from "@/types/orders.types";

interface AreaListProps {
  areas: TableArea[];
  onReorder: (areas: TableArea[]) => void;
  onEdit: (area: TableArea) => void;
  onDelete: (area: TableArea) => void;
  onToggleActive: (area: TableArea) => void;
}

function SortableAreaItem({
  area,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  area: TableArea;
  onEdit: (area: TableArea) => void;
  onDelete: (area: TableArea) => void;
  onToggleActive: (area: TableArea) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tablesCount = area._count?.tables || area.tables?.length || 0;

  return (
    <Card ref={setNodeRef} style={style} className="p-4">
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Color indicator */}
        <div
          className="w-3 h-10 rounded"
          style={{ backgroundColor: area.color || "#3b82f6" }}
        />

        {/* Area info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{area.name}</h3>
            {!area.isActive && (
              <Badge variant="secondary" className="text-xs">
                Inactiva
              </Badge>
            )}
          </div>
          {area.description && (
            <p className="text-sm text-muted-foreground truncate">
              {area.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>
                {tablesCount} {tablesCount === 1 ? "mesa" : "mesas"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(area)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(area)}>
              {area.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Desactivar
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(area)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

export function AreaList({
  areas,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
}: AreaListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const areaIds = useMemo(() => areas.map((area) => area.id), [areas]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = areas.findIndex((area) => area.id === active.id);
      const newIndex = areas.findIndex((area) => area.id === over.id);

      const reorderedAreas = arrayMove(areas, oldIndex, newIndex).map(
        (area, index) => ({
          ...area,
          order: index,
        })
      );

      onReorder(reorderedAreas);
    }
  };

  if (areas.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No hay áreas creadas. Crea tu primera área para comenzar.
        </p>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={areaIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {areas.map((area) => (
            <SortableAreaItem
              key={area.id}
              area={area}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
