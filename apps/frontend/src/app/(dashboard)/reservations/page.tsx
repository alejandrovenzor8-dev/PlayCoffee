"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { partyPackagesApi, reservationsApi, tablesApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRealtime } from "@/hooks/useRealtime";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";
import {
  CalendarDays,
  Check,
  Clock,
  Edit,
  Loader2,
  PackagePlus,
  Plus,
} from "lucide-react";

type ReservationStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";
type CalendarMode = "month" | "week" | "day";

interface Area {
  id: string;
  name: string;
}

interface PartyPackage {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration: number;
  maxGuests: number;
  minDeposit?: number | null;
  isActive: boolean;
}

interface Reservation {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  reservedAt: string;
  endTime?: string | null;
  duration: number;
  partySize: number;
  status: ReservationStatus;
  notes?: string | null;
  area?: Area | null;
  table?: { id: string; number: string; area?: Area } | null;
  package?: PartyPackage | null;
  packageId?: string | null;
  areaId?: string | null;
  depositAmount: number;
  totalAmount: number;
}

const statusConfig: Record<ReservationStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: "Pendiente", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  CONFIRMED: { label: "Confirmada", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  ARRIVED: { label: "En salon", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelada", badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  NO_SHOW: { label: "No asistio", badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  COMPLETED: { label: "Completada", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

const emptyReservationForm = {
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  reservedDate: toDateInput(new Date()),
  startTime: "12:00",
  endTime: "14:00",
  areaId: "none",
  packageId: "none",
  partySize: "10",
  totalAmount: "0",
  depositAmount: "0",
  notes: "",
};

const emptyPackageForm = {
  name: "",
  description: "",
  price: "0",
  duration: "120",
  maxGuests: "10",
  minDeposit: "0",
};

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const canManageReservations = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "CASHIER";
  const canManagePackages = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [packages, setPackages] = useState<PartyPackage[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<CalendarMode>("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">("ALL");
  const [reservationOpen, setReservationOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [packageOpen, setPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PartyPackage | null>(null);
  const [reservationForm, setReservationForm] = useState(emptyReservationForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  const visibleDays = useMemo(() => {
    if (mode === "day") return [selectedDate];
    if (mode === "week") {
      const start = startOfWeek(selectedDate);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 35 }, (_, index) => addDays(gridStart, index));
  }, [mode, selectedDate]);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    const start = visibleDays[0].toISOString();
    const end = addDays(visibleDays[visibleDays.length - 1], 1).toISOString();
    Promise.all([
      reservationsApi.calendar({ branchId, start, end }),
      partyPackagesApi.getAll(true),
      tablesApi.getAreas(branchId),
    ])
      .then(([reservationData, packageData, areaData]) => {
        setReservations(reservationData);
        setPackages(packageData);
        setAreas(areaData);
      })
      .catch(() => {
        setReservations([]);
        setLoadError("No se pudieron cargar las reservas. Verifica la API y permisos.");
      })
      .finally(() => setIsLoading(false));
  }, [branchId, visibleDays]);

  const realtimeEvents = useMemo(() => ({
    "reservation.created": () => loadData(),
    "reservation.updated": () => loadData(),
    "reservation.cancelled": () => loadData(),
  }), [loadData]);
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredReservations = reservations.filter((reservation) =>
    statusFilter === "ALL" ? true : reservation.status === statusFilter,
  );

  const totals = {
    today: reservations.filter((reservation) => sameDay(new Date(reservation.reservedAt), new Date())).length,
    confirmed: reservations.filter((reservation) => reservation.status === "CONFIRMED").length,
    pending: reservations.filter((reservation) => reservation.status === "PENDING").length,
    deposits: reservations.reduce((sum, reservation) => sum + Number(reservation.depositAmount ?? 0), 0),
  };

  const resetReservationForm = () => {
    setEditingReservation(null);
    setReservationForm(emptyReservationForm);
  };

  const openReservationForm = (reservation?: Reservation) => {
    if (reservation) {
      const start = new Date(reservation.reservedAt);
      const end = reservation.endTime ? new Date(reservation.endTime) : new Date(start.getTime() + reservation.duration * 60000);
      setEditingReservation(reservation);
      setReservationForm({
        contactName: reservation.contactName,
        contactPhone: reservation.contactPhone,
        contactEmail: reservation.contactEmail ?? "",
        reservedDate: toDateInput(start),
        startTime: toTimeInput(start),
        endTime: toTimeInput(end),
        areaId: reservation.areaId ?? reservation.area?.id ?? "none",
        packageId: reservation.packageId ?? reservation.package?.id ?? "none",
        partySize: String(reservation.partySize),
        totalAmount: String(Number(reservation.totalAmount ?? 0)),
        depositAmount: String(Number(reservation.depositAmount ?? 0)),
        notes: reservation.notes ?? "",
      });
    } else {
      resetReservationForm();
    }
    setReservationOpen(true);
  };

  const handlePackageChange = (packageId: string) => {
    const selected = packages.find((item) => item.id === packageId);
    setReservationForm((prev) => {
      const start = new Date(`${prev.reservedDate}T${prev.startTime}`);
      const end = selected ? new Date(start.getTime() + selected.duration * 60000) : new Date(`${prev.reservedDate}T${prev.endTime}`);
      return {
        ...prev,
        packageId,
        endTime: toTimeInput(end),
        totalAmount: selected ? String(Number(selected.price)) : prev.totalAmount,
        depositAmount: selected?.minDeposit ? String(Number(selected.minDeposit)) : prev.depositAmount,
        partySize: selected ? String(selected.maxGuests) : prev.partySize,
      };
    });
  };

  const handleSaveReservation = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    const payload = {
      branchId,
      contactName: reservationForm.contactName,
      contactPhone: reservationForm.contactPhone,
      contactEmail: reservationForm.contactEmail || undefined,
      reservedAt: new Date(`${reservationForm.reservedDate}T${reservationForm.startTime}`).toISOString(),
      endTime: new Date(`${reservationForm.reservedDate}T${reservationForm.endTime}`).toISOString(),
      areaId: reservationForm.areaId === "none" ? undefined : reservationForm.areaId,
      packageId: reservationForm.packageId === "none" ? undefined : reservationForm.packageId,
      partySize: Number(reservationForm.partySize),
      totalAmount: Number(reservationForm.totalAmount),
      depositAmount: Number(reservationForm.depositAmount),
      notes: reservationForm.notes || undefined,
    };
    try {
      if (editingReservation) {
        await reservationsApi.update(editingReservation.id, payload);
      } else {
        await reservationsApi.create(payload);
      }
      setReservationOpen(false);
      resetReservationForm();
      loadData();
    } catch {
      setLoadError("No se pudo guardar la reserva. Revisa horarios, area, anticipo y paquete.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    setLoadError(null);
    try {
      await reservationsApi.updateStatus(id, status);
      loadData();
    } catch {
      setLoadError("No se pudo actualizar la reserva.");
    }
  };

  const openPackageForm = (partyPackage?: PartyPackage) => {
    if (partyPackage) {
      setEditingPackage(partyPackage);
      setPackageForm({
        name: partyPackage.name,
        description: partyPackage.description ?? "",
        price: String(Number(partyPackage.price)),
        duration: String(partyPackage.duration),
        maxGuests: String(partyPackage.maxGuests),
        minDeposit: String(Number(partyPackage.minDeposit ?? 0)),
      });
    } else {
      setEditingPackage(null);
      setPackageForm(emptyPackageForm);
    }
    setPackageOpen(true);
  };

  const handleSavePackage = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    const payload = {
      name: packageForm.name,
      description: packageForm.description || undefined,
      price: Number(packageForm.price),
      duration: Number(packageForm.duration),
      maxGuests: Number(packageForm.maxGuests),
      minDeposit: Number(packageForm.minDeposit || 0),
    };
    try {
      if (editingPackage) {
        await partyPackagesApi.update(editingPackage.id, payload);
      } else {
        await partyPackagesApi.create(payload);
      }
      setPackageOpen(false);
      loadData();
    } catch {
      setLoadError("No se pudo guardar el paquete. Revisa precio y anticipo minimo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePackage = async (partyPackage: PartyPackage) => {
    await partyPackagesApi.update(partyPackage.id, { isActive: !partyPackage.isActive });
    loadData();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservaciones"
        description="Calendario de fiestas, salones, anticipos y paquetes"
        actions={
          canManageReservations ? (
            <div className="flex items-center gap-2">
              <RealtimeIndicator status={realtimeStatus} />
              <Button onClick={() => openReservationForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva reserva
              </Button>
            </div>
          ) : undefined
        }
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Hoy", value: totals.today, icon: CalendarDays },
          { label: "Confirmadas", value: totals.confirmed, icon: Check },
          { label: "Pendientes", value: totals.pending, icon: Clock },
          { label: "Anticipos", value: formatCurrency(totals.deposits), icon: PackagePlus },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="packages">Paquetes</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, mode === "month" ? -30 : mode === "week" ? -7 : -1))}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>Hoy</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, mode === "month" ? 30 : mode === "week" ? 7 : 1))}>Siguiente</Button>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: ReservationStatus | "ALL") => setStatusFilter(value)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mode} onValueChange={(value: CalendarMode) => setMode(value)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={cn("grid gap-3", mode === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7")}>
              {visibleDays.map((day) => {
                const dayReservations = filteredReservations.filter((reservation) => sameDay(new Date(reservation.reservedAt), day));
                return (
                  <Card key={day.toISOString()} className={cn(!sameDay(day, selectedDate) && mode === "month" && day.getMonth() !== selectedDate.getMonth() && "opacity-50")}>
                    <CardContent className="min-h-40 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">{day.toLocaleDateString("es-MX", { weekday: "short" })}</p>
                          <p className="text-lg font-bold">{day.getDate()}</p>
                        </div>
                        {sameDay(day, new Date()) && <Badge variant="secondary">Hoy</Badge>}
                      </div>
                      <div className="space-y-2">
                        {dayReservations.map((reservation) => {
                          const config = statusConfig[reservation.status];
                          const balance = Number(reservation.totalAmount ?? 0) - Number(reservation.depositAmount ?? 0);
                          return (
                            <button
                              key={reservation.id}
                              className="w-full rounded-md border bg-background p-2 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50"
                              onClick={() => openReservationForm(reservation)}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", config.dot)} />
                                <span className="font-semibold">{formatTime(reservation.reservedAt)}</span>
                                <span className="truncate">{reservation.contactName}</span>
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                {reservation.area?.name ?? "Sin area"} · {reservation.partySize} ninos
                              </div>
                              <div className="mt-1 flex justify-between">
                                <span>{reservation.package?.name ?? "Sin paquete"}</span>
                                <span>{formatCurrency(balance)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <div className="flex justify-end">
            {canManagePackages && (
              <Button onClick={() => openPackageForm()}>
                <PackagePlus className="mr-2 h-4 w-4" />
                Nuevo paquete
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((partyPackage) => (
              <Card key={partyPackage.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{partyPackage.name}</p>
                      <p className="text-sm text-muted-foreground">{partyPackage.description ?? "Sin descripcion"}</p>
                    </div>
                    <Badge variant="outline" className={partyPackage.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                      {partyPackage.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted p-2"><p className="text-muted-foreground">Precio</p><p className="font-bold">{formatCurrency(partyPackage.price)}</p></div>
                    <div className="rounded-md bg-muted p-2"><p className="text-muted-foreground">Duracion</p><p className="font-bold">{partyPackage.duration} min</p></div>
                    <div className="rounded-md bg-muted p-2"><p className="text-muted-foreground">Limite</p><p className="font-bold">{partyPackage.maxGuests} ninos</p></div>
                    <div className="rounded-md bg-muted p-2"><p className="text-muted-foreground">Anticipo</p><p className="font-bold">{formatCurrency(partyPackage.minDeposit ?? 0)}</p></div>
                  </div>
                  {canManagePackages && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openPackageForm(partyPackage)}>
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => togglePackage(partyPackage)}>
                        {partyPackage.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={reservationOpen} onOpenChange={(open) => {
        setReservationOpen(open);
        if (!open) resetReservationForm();
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingReservation ? "Editar reserva" : "Nueva reserva"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Responsable</Label><Input value={reservationForm.contactName} onChange={(event) => setReservationForm((prev) => ({ ...prev, contactName: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Telefono</Label><Input value={reservationForm.contactPhone} onChange={(event) => setReservationForm((prev) => ({ ...prev, contactPhone: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={reservationForm.contactEmail} onChange={(event) => setReservationForm((prev) => ({ ...prev, contactEmail: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Ninos estimados</Label><Input type="number" min={0} value={reservationForm.partySize} onChange={(event) => setReservationForm((prev) => ({ ...prev, partySize: event.target.value }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={reservationForm.reservedDate} onChange={(event) => setReservationForm((prev) => ({ ...prev, reservedDate: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Inicio</Label><Input type="time" value={reservationForm.startTime} onChange={(event) => setReservationForm((prev) => ({ ...prev, startTime: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fin</Label><Input type="time" value={reservationForm.endTime} onChange={(event) => setReservationForm((prev) => ({ ...prev, endTime: event.target.value }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Area / salon</Label>
                <Select value={reservationForm.areaId} onValueChange={(value) => setReservationForm((prev) => ({ ...prev, areaId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin area</SelectItem>
                    {areas.map((area) => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Paquete</Label>
                <Select value={reservationForm.packageId} onValueChange={handlePackageChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin paquete</SelectItem>
                    {packages.filter((item) => item.isActive).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Total</Label><Input type="number" min={0} value={reservationForm.totalAmount} onChange={(event) => setReservationForm((prev) => ({ ...prev, totalAmount: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Anticipo</Label><Input type="number" min={0} value={reservationForm.depositAmount} onChange={(event) => setReservationForm((prev) => ({ ...prev, depositAmount: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Saldo</Label><div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-semibold">{formatCurrency(Math.max(0, Number(reservationForm.totalAmount || 0) - Number(reservationForm.depositAmount || 0)))}</div></div>
            </div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={reservationForm.notes} onChange={(event) => setReservationForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
            {editingReservation && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(editingReservation.id, "CONFIRMED")}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange(editingReservation.id, "COMPLETED")}>Completar</Button>
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => handleStatusChange(editingReservation.id, "CANCELLED")}>Cancelar</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReservationOpen(false)}>Cerrar</Button>
            <Button onClick={handleSaveReservation} disabled={!reservationForm.contactName || !reservationForm.contactPhone || !reservationForm.reservedDate || !reservationForm.startTime || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={packageOpen} onOpenChange={setPackageOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingPackage ? "Editar paquete" : "Nuevo paquete"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={packageForm.name} onChange={(event) => setPackageForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Descripcion</Label><Textarea value={packageForm.description} onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Precio</Label><Input type="number" min={0} value={packageForm.price} onChange={(event) => setPackageForm((prev) => ({ ...prev, price: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Duracion fija</Label><Input type="number" min={30} value={packageForm.duration} onChange={(event) => setPackageForm((prev) => ({ ...prev, duration: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Limite de ninos</Label><Input type="number" min={1} value={packageForm.maxGuests} onChange={(event) => setPackageForm((prev) => ({ ...prev, maxGuests: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Anticipo minimo</Label><Input type="number" min={0} value={packageForm.minDeposit} onChange={(event) => setPackageForm((prev) => ({ ...prev, minDeposit: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePackage} disabled={!packageForm.name || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar paquete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
