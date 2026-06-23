"use client";

import { useCallback, useEffect, useState } from "react";
import { reservationsApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Check, Clock, Loader2, Phone, Plus, Users, X } from "lucide-react";

type ReservationStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

interface Reservation {
  id: string;
  branchId: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  reservedAt: string;
  partySize: number;
  status: ReservationStatus;
  notes?: string;
  table?: { number: string };
}

const STATUS_CONFIG: Record<ReservationStatus, { label: string; badge: string }> = {
  PENDING: { label: "Pendiente", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  CONFIRMED: { label: "Confirmada", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  ARRIVED: { label: "En mesa", badge: "bg-green-100 text-green-800 border-green-300" },
  CANCELLED: { label: "Cancelada", badge: "bg-red-100 text-red-800 border-red-300" },
  NO_SHOW: { label: "No se presento", badge: "bg-gray-100 text-gray-600 border-gray-300" },
  COMPLETED: { label: "Completada", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    reservedDate: "",
    reservedTime: "",
    partySize: "2",
    notes: "",
  });

  const loadReservations = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    reservationsApi.getAll({ branchId })
      .then(setReservations)
      .catch(() => {
        setReservations([]);
        setLoadError("No se pudieron cargar las reservaciones. Verifica que la API este disponible.");
      })
      .finally(() => setIsLoading(false));
  }, [branchId]);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  const resetForm = () => {
    setForm({
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      reservedDate: "",
      reservedTime: "",
      partySize: "2",
      notes: "",
    });
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    const reservedAt = new Date(`${form.reservedDate}T${form.reservedTime}`).toISOString();
    try {
      await reservationsApi.create({
        branchId,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail || undefined,
        reservedAt,
        partySize: Number(form.partySize),
        notes: form.notes || undefined,
      });
      setFormOpen(false);
      resetForm();
      loadReservations();
    } catch {
      setLoadError("No se pudo crear la reservacion. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    setLoadError(null);
    try {
      const updated = await reservationsApi.updateStatus(id, status);
      setReservations((prev) => prev.map((reservation) => reservation.id === id ? updated : reservation));
    } catch {
      setLoadError("No se pudo actualizar la reservacion. Intenta de nuevo.");
    }
  };

  const todayReservations = reservations.filter((reservation) => {
    const date = new Date(reservation.reservedAt);
    return date.toDateString() === new Date().toDateString();
  });
  const upcoming = reservations.filter((reservation) =>
    new Date(reservation.reservedAt) > new Date() && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(reservation.status)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservaciones"
        description="Gestion de reservaciones y eventos"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Reservacion
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Hoy", value: todayReservations.length, icon: CalendarDays, color: "text-blue-600 bg-blue-50" },
          { label: "Proximas", value: upcoming.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Confirmadas", value: reservations.filter((r) => r.status === "CONFIRMED").length, icon: Check, color: "text-green-600 bg-green-50" },
          { label: "Pendientes", value: reservations.filter((r) => r.status === "PENDING").length, icon: Clock, color: "text-orange-600 bg-orange-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color.split(" ")[1])}>
                <Icon className={cn("h-5 w-5", color.split(" ")[0])} />
              </div>
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <CalendarDays className="mb-3 h-12 w-12 opacity-30" />
            <p>No hay reservaciones registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => {
            const { label, badge } = STATUS_CONFIG[reservation.status];
            const isPast = new Date(reservation.reservedAt) < new Date();
            return (
              <Card key={reservation.id} className={cn("overflow-hidden", isPast && reservation.status === "PENDING" && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{reservation.contactName}</p>
                        <Badge className={cn("border text-xs", badge)} variant="outline">{label}</Badge>
                        {reservation.table && <Badge variant="secondary" className="text-xs">Mesa {reservation.table.number}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(reservation.reservedAt)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{reservation.partySize} personas</span>
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{reservation.contactPhone}</span>
                      </div>
                      {reservation.notes && <p className="text-xs italic text-muted-foreground">&quot;{reservation.notes}&quot;</p>}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {reservation.status === "PENDING" && (
                        <Button size="sm" variant="outline" className="text-green-700 hover:bg-green-50" onClick={() => handleStatusChange(reservation.id, "CONFIRMED")}>
                          <Check className="mr-1 h-3.5 w-3.5" />Confirmar
                        </Button>
                      )}
                      {reservation.status === "CONFIRMED" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(reservation.id, "ARRIVED")}>
                          Sentar
                        </Button>
                      )}
                      {reservation.status === "ARRIVED" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(reservation.id, "COMPLETED")}>
                          Completar
                        </Button>
                      )}
                      {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") && (
                        <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50" onClick={() => handleStatusChange(reservation.id, "CANCELLED")}>
                          <X className="mr-1 h-3.5 w-3.5" />Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Reservacion</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label>Nombre del cliente *</Label>
              <Input value={form.contactName} onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefono *</Label>
                <Input value={form.contactPhone} onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Personas *</Label>
                <Select value={form.partySize} onValueChange={(value) => setForm((prev) => ({ ...prev, partySize: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} personas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.contactEmail} onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha *</Label>
                <Input type="date" value={form.reservedDate} onChange={(event) => setForm((prev) => ({ ...prev, reservedDate: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora *</Label>
                <Input type="time" value={form.reservedTime} onChange={(event) => setForm((prev) => ({ ...prev, reservedTime: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.contactName || !form.contactPhone || !form.reservedDate || !form.reservedTime || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear Reservacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
