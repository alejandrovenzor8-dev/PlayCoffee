"use client";

import { useState } from "react";
import { TableCanvas } from "./TableCanvas";
import type { RestaurantTable, TableStatus } from "@/types/orders.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  RotateCw,
  Save,
  X,
  Circle,
  Square,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutEditorProps {
  tables: RestaurantTable[];
  onTablesUpdate: (tables: RestaurantTable[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function LayoutEditor({
  tables,
  onTablesUpdate,
  onSave,
  onCancel,
}: LayoutEditorProps) {
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [editForm, setEditForm] = useState<Partial<RestaurantTable>>({});

  // Actualizar mesa individual
  const handleTableUpdate = (id: string, updates: Partial<RestaurantTable>) => {
    const updatedTables = tables.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    onTablesUpdate(updatedTables);

    // Actualizar mesa seleccionada si es la que se está editando
    if (selectedTable?.id === id) {
      setSelectedTable({ ...selectedTable, ...updates });
      setEditForm({ ...editForm, ...updates });
    }
  };

  // Seleccionar mesa
  const handleTableSelect = (table: RestaurantTable) => {
    setSelectedTable(table);
    setEditForm(table);
  };

  // Crear nueva mesa
  const handleCreateTable = () => {
    const newTable: RestaurantTable = {
      id: `temp-${Date.now()}`,
      areaId: tables[0]?.areaId || "",
      number: `${tables.length + 1}`,
      capacity: 4,
      status: "AVAILABLE",
      posX: 100,
      posY: 100,
      width: 120,
      height: 120,
      rotation: 0,
      shape: "rect",
      isActive: true,
    };
    onTablesUpdate([...tables, newTable]);
    setSelectedTable(newTable);
    setEditForm(newTable);
  };

  // Eliminar mesa
  const handleDeleteTable = () => {
    if (!selectedTable) return;
    const updatedTables = tables.filter((t) => t.id !== selectedTable.id);
    onTablesUpdate(updatedTables);
    setSelectedTable(null);
    setEditForm({});
  };

  // Rotar mesa
  const handleRotate = () => {
    if (!selectedTable) return;
    const newRotation = ((selectedTable.rotation || 0) + 45) % 360;
    handleTableUpdate(selectedTable.id, { rotation: newRotation });
  };

  // Actualizar propiedades de la mesa
  const updateTableProperty = (key: keyof RestaurantTable, value: any) => {
    if (!selectedTable) return;
    handleTableUpdate(selectedTable.id, { [key]: value });
  };

  return (
    <div className="h-full flex gap-4">
      {/* Canvas principal */}
      <div className="flex-1 border rounded-lg overflow-hidden bg-white">
        <TableCanvas
          tables={tables}
          isEditMode={true}
          selectedTableId={selectedTable?.id}
          onTableSelect={handleTableSelect}
          onTableUpdate={handleTableUpdate}
          areaName="Editor de Layout"
        />
      </div>

      {/* Panel de propiedades */}
      <Card className="w-80 h-full overflow-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Propiedades</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedTable(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!selectedTable ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Selecciona una mesa para editarla</p>
              <p className="text-xs mt-2">o crea una nueva</p>
            </div>
          ) : (
            <>
              {/* Número de mesa */}
              <div className="space-y-2">
                <Label htmlFor="table-number">Número de Mesa</Label>
                <Input
                  id="table-number"
                  value={editForm.number || ""}
                  onChange={(e) => updateTableProperty("number", e.target.value)}
                  placeholder="ej. 1, T1, VIP-1"
                />
              </div>

              {/* Capacidad */}
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="20"
                  value={editForm.capacity || 4}
                  onChange={(e) => updateTableProperty("capacity", parseInt(e.target.value))}
                />
              </div>

              {/* Forma */}
              <div className="space-y-2">
                <Label>Forma</Label>
                <Tabs
                  value={editForm.shape || "rect"}
                  onValueChange={(v) => updateTableProperty("shape", v)}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="rect" className="text-xs">
                      <Square className="h-3 w-3 mr-1" />
                      Cuadro
                    </TabsTrigger>
                    <TabsTrigger value="circle" className="text-xs">
                      <Circle className="h-3 w-3 mr-1" />
                      Círculo
                    </TabsTrigger>
                    <TabsTrigger value="oval" className="text-xs">
                      Óvalo
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Tamaño */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="width" className="text-xs">Ancho</Label>
                  <Input
                    id="width"
                    type="number"
                    min="80"
                    max="300"
                    value={editForm.width || 120}
                    onChange={(e) => updateTableProperty("width", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height" className="text-xs">Alto</Label>
                  <Input
                    id="height"
                    type="number"
                    min="80"
                    max="300"
                    value={editForm.height || 120}
                    onChange={(e) => updateTableProperty("height", parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Posición */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="posX" className="text-xs">Posición X</Label>
                  <Input
                    id="posX"
                    type="number"
                    value={Math.round(editForm.posX || 0)}
                    onChange={(e) => updateTableProperty("posX", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="posY" className="text-xs">Posición Y</Label>
                  <Input
                    id="posY"
                    type="number"
                    value={Math.round(editForm.posY || 0)}
                    onChange={(e) => updateTableProperty("posY", parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Rotación */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Rotación</Label>
                  <Badge variant="secondary">{editForm.rotation || 0}°</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleRotate}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Rotar 45°
                </Button>
              </div>

              {/* Color personalizado */}
              <div className="space-y-2">
                <Label htmlFor="color">Color Personalizado</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={editForm.color || "#3b82f6"}
                    onChange={(e) => updateTableProperty("color", e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={editForm.color || ""}
                    onChange={(e) => updateTableProperty("color", e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                  {editForm.color && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateTableProperty("color", undefined)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={editForm.status || "AVAILABLE"}
                  onValueChange={(v: TableStatus) => updateTableProperty("status", v)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Disponible</SelectItem>
                    <SelectItem value="OCCUPIED">Ocupada</SelectItem>
                    <SelectItem value="RESERVED">Reservada</SelectItem>
                    <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                    <SelectItem value="BLOCKED">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Eliminar mesa */}
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleDeleteTable}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Mesa
              </Button>
            </>
          )}

          {/* Crear nueva mesa */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCreateTable}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Mesa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Barra de acciones flotante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-white border shadow-lg rounded-lg p-3">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
