"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AreaList } from "@/components/areas/AreaList";
import { AreaFormDialog } from "@/components/areas/AreaFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2 } from "lucide-react";
import { areasApi } from "@/lib/api";
import { useAreasStore } from "@/store/areas.store";
import { toast } from "@/components/ui/use-toast";
import type { TableArea } from "@/types/orders.types";

// TODO: Obtener branchId del contexto de autenticación
const BRANCH_ID = "branch-1";

export default function AreasPage() {
  const queryClient = useQueryClient();
  const { areas, setAreas } = useAreasStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<TableArea | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<TableArea | null>(null);

  // Cargar áreas
  const { data, isLoading, error } = useQuery({
    queryKey: ["areas", BRANCH_ID],
    queryFn: () => areasApi.getAll(BRANCH_ID),
  });

  useEffect(() => {
    if (data) {
      setAreas(data);
    }
  }, [data, setAreas]);

  // Mutación para crear área
  const createMutation = useMutation({
    mutationFn: (data: Partial<TableArea>) => areasApi.create(BRANCH_ID, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", BRANCH_ID] });
      toast({
        title: "Área creada",
        description: "El área se ha creado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el área",
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar área
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableArea> }) =>
      areasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", BRANCH_ID] });
      toast({
        title: "Área actualizada",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el área",
        variant: "destructive",
      });
    },
  });

  // Mutación para reordenar áreas
  const reorderMutation = useMutation({
    mutationFn: (areaIds: string[]) => areasApi.reorder(BRANCH_ID, areaIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", BRANCH_ID] });
      toast({
        title: "Orden actualizado",
        description: "El orden de las áreas se ha actualizado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el orden",
        variant: "destructive",
      });
    },
  });

  // Mutación para alternar activo/inactivo
  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => areasApi.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", BRANCH_ID] });
      toast({
        title: "Estado actualizado",
        description: "El estado del área se ha actualizado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar área
  const deleteMutation = useMutation({
    mutationFn: (id: string) => areasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", BRANCH_ID] });
      toast({
        title: "Área eliminada",
        description: "El área se ha eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "No se pudo eliminar el área";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleCreateArea = () => {
    setSelectedArea(null);
    setIsDialogOpen(true);
  };

  const handleEditArea = (area: TableArea) => {
    setSelectedArea(area);
    setIsDialogOpen(true);
  };

  const handleSaveArea = async (data: Partial<TableArea>) => {
    if (selectedArea) {
      await updateMutation.mutateAsync({ id: selectedArea.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleDeleteArea = (area: TableArea) => {
    setAreaToDelete(area);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (areaToDelete) {
      await deleteMutation.mutateAsync(areaToDelete.id);
      setIsDeleteDialogOpen(false);
      setAreaToDelete(null);
    }
  };

  const handleReorder = (reorderedAreas: TableArea[]) => {
    // Actualizar UI inmediatamente
    setAreas(reorderedAreas);
    // Enviar al servidor
    const areaIds = reorderedAreas.map((area) => area.id);
    reorderMutation.mutate(areaIds);
  };

  const handleToggleActive = (area: TableArea) => {
    toggleActiveMutation.mutate(area.id);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive">Error al cargar las áreas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con botón */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Áreas del Restaurante</h3>
          <p className="text-sm text-muted-foreground">
            Administra las áreas de tu restaurante para organizar mejor las mesas
          </p>
        </div>
        <Button onClick={handleCreateArea} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Área
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AreaList
          areas={areas}
          onReorder={handleReorder}
          onEdit={handleEditArea}
          onDelete={handleDeleteArea}
          onToggleActive={handleToggleActive}
        />
      )}

      {/* Dialog para crear/editar área */}
      <AreaFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        area={selectedArea}
        onSave={handleSaveArea}
      />

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar área?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El área &quot;{areaToDelete?.name}&quot;
              será eliminada permanentemente.
              {areaToDelete && (areaToDelete._count?.tables || 0) > 0 && (
                <span className="block mt-2 text-destructive font-semibold">
                  Advertencia: Esta área tiene{" "}
                  {areaToDelete._count?.tables || 0} mesa(s) asignada(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
