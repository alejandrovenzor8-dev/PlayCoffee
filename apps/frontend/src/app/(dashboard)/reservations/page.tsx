"use client";

import { useEffect, useState, useCallback } from "react";
import { reservationsApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Plus, Clock, Users, Phone, Check, X, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type ReservationStatus = "PENDING" | "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  reservationDate: string;
  partySize: number;
  status: ReservationStatus;
  notes?: string;
  tableId?: string;
  table?: { number: string };
}

const STATUS_CONFIG: Record<ReservationStatus, { label: string; badge: string }> = {
  PENDING: { label: "Pendiente", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  CONFIRMED: { label: "Confirmada", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  SEATED: { label: "En mesa", badge: "bg-green-100 text-green-800 border-green-300" },
  CANCELLED: { label: "Cancelada", badge: "bg-red-100 text-red-800 border-red-300" },
  NO_SHOW: { label: "No se presentó", badge: "bg-gray-100 text-gray-600 border-gray-300" },
  COMPLETED: { label: "Completada", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

const mockReservations: Reservation[] = [
  {
    id: "r1", customerName: "Ana Rodríguez", customerPhone: "555-1001",
    reservationDate: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
    partySize: 4, status: "CONFIRMED", notes: "Mesa junto a ventana de ser posible",
    table: { number: "5" },
  },
  {
    id: "r2", customerName: "Luis Hernández", customerPhone: "555-1002",
    reservationDate: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    partySize: 2, status: "PENDING",
  },
  {
    id: "r3", customerName: "María González", customerPhone: "555-1003",
    reservationDate: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    partySize: 6, status: "CONFIRMED", notes: "Aniversario, solicitan decoración especial",
  },
  {
    id: "r4", customerName: "Pedro Sánchez", customerPhone: "555-1004",
    reservationDate: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    partySize: 3, status: "SEATED", table: { number: "2" },
  },
];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    reservationDate: "",
    reservationTime: "",
    partySize: "2",
    notes: "",
  });

  const loadReservations = useCallback(() => {
    reservationsApi.getAll()
      .then(setReservations)
      .catch(() => setReservations(mockReservations))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  const handleCreate = async () => {
    setIsSubmitting(true);
    const reservationDate = form.reservationDate && form.reservationTime
      ? new Date(`${form.reservationDate}T${form.reservationTime}`).toISOString()
      : new Date().toISOString();
    try {
      await reservationsApi.create({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        reservationDate,
        partySize: Number(form.partySize),
        notes: form.notes || undefined,
      });
      loadReservations();
    } catch {
      setReservations((prev) => [...prev, {
        id: `r-${Date.now()}`,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        reservationDate,
        partySize: Number(form.partySize),
        status: "PENDING",
        notes: form.notes || undefined,
      }]);
    } finally {
      setIsSubmitting(false);
      setFormOpen(false);
      setForm({ customerName: "", customerPhone: "", customerEmail: "", reservationDate: "", reservationTime: "", partySize: "2", notes: "" });
    }
  };

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    try { await reservationsApi.updateStatus(id, status); } catch { /* ignore */ }
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const todayReservations = reservations.filter((r) => {
    const d = new Date(r.reservationDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const upcoming = reservations.filter((r) => new Date(r.reservationDate) > new Date() && r.status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservaciones"
        description="Gestión de reservaciones y eventos"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reservación
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Hoy", value: todayReservations.length, icon: CalendarDays, color: "text-blue-600 bg-blue-50" },
          { label: "Próximas", value: upcoming.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Confirmadas", value: reservations.filter((r) => r.status === "CONFIRMED").length, icon: Check, color: "text-green-600 bg-green-50" },
          { label: "Pendientes", value: reservations.filter((r) => r.status === "PENDING").length, icon: Clock, color: "text-orange-600 bg-orange-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
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

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 opacity-30 mb-3" />
                <p>No hay reservaciones registradas</p>
              </CardContent>
            </Card>
          ) : (
            reservations.map((res) => {
              const { label, badge } = STATUS_CONFIG[res.status];
              const isPast = new Date(res.reservationDate) < new Date();

              return (
                <Card key={res.id} className={cn("overflow-hidden", isPast && res.status === "PENDING" && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{res.customerName}</p>
                          <Badge className={cn("border text-xs", badge)} variant="outline">{label}</Badge>
                          {res.table && (
                            <Badge variant="secondary" className="text-xs">Mesa {res.table.number}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(res.reservationDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {res.partySize} personas
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {res.customerPhone}
                          </span>
                        </div>
                        {res.notes && (
                          <p className="text-xs text-muted-foreground italic">"{res.notes}"</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {res.status === "PENDING" && (
                          <Button size="sm" variant="outline" className="text-green-700 hover:bg-green-50"
                            onClick={() => handleStatusChange(res.id, "CONFIRMED")}>
                            <Check className="h-3.5 w-3.5 mr-1" />Confirmar
                          </Button>
                        )}
                        {res.status === "CONFIRMED" && (
                          <Button size="sm" variant="outline"
                            onClick={() => handleStatusChange(res.id, "SEATED")}>
                            Sentar
                          </Button>
                        )}
                        {(res.status === "PENDING" || res.status === "CONFIRMED") && (
                          <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50"
                            onClick={() => handleStatusChange(res.id, "CANCELLED")}>
                            <X className="h-3.5 w-3.5 mr-1" />Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Reservación</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label>Nombre del cliente *</Label>
              <Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono *</Label>
                <Input value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Personas *</Label>
                <Select value={form.partySize} onValueChange={(v) => setForm((f) => ({ ...f, partySize: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,10,12,15,20].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} personas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha *</Label>
                <Input type="date" value={form.reservationDate} onChange={(e) => setForm((f) => ({ ...f, reservationDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora *</Label>
                <Input type="time" value={form.reservationTime} onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Solicitudes especiales, alergias, etc."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.customerName || !form.customerPhone || !form.reservationDate || !form.reservationTime || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear Reservación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
