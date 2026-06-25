"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { childAccessApi, ordersApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { useRealtime } from "@/hooks/useRealtime";
import { RealtimeIndicator } from "@/components/realtime/realtime-indicator";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

type AccessMode = "HOURLY" | "FREE";
type AccessStatus = "ACTIVE" | "WARNING" | "GRACE" | "OVERTIME" | "COMPLETED";

interface ChildRecord {
  id: string;
  childName: string;
  childAge?: number;
  guardianName: string;
  guardianPhone?: string;
  accessMode: AccessMode;
  accessCode: string;
  entryTime: string;
  exitTime?: string;
  contractedMinutes?: number;
  maxDuration?: number;
  warningMinutes: number;
  graceMinutes: number;
  hourlyRate?: number;
  freePrice?: number;
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
  runtimeStatus: AccessStatus;
  elapsedMinutes: number;
  remainingMinutes?: number | null;
  extraHours: number;
  calculatedExtraAmount: number;
  calculatedTotalAmount: number;
  notes?: string;
  orderId?: string | null;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
  } | null;
}

interface OpenOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
}

const statusConfig: Record<AccessStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Normal", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  WARNING: { label: "Por terminar", className: "bg-amber-50 text-amber-700 border-amber-200" },
  GRACE: { label: "Tolerancia", className: "bg-sky-50 text-sky-700 border-sky-200" },
  OVERTIME: { label: "Excedido", className: "bg-red-50 text-red-700 border-red-200" },
  COMPLETED: { label: "Finalizado", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

function calculateClientStatus(record: ChildRecord) {
  if (record.exitTime) return { ...record, runtimeStatus: "COMPLETED" as AccessStatus };
  if (record.accessMode === "FREE") {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(record.entryTime).getTime()) / 60000));
    return { ...record, elapsedMinutes, runtimeStatus: "ACTIVE" as AccessStatus };
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(record.entryTime).getTime()) / 60000));
  const contracted = record.contractedMinutes ?? record.maxDuration ?? 0;
  const remainingMinutes = Math.max(0, contracted - elapsedMinutes);
  let runtimeStatus: AccessStatus = "ACTIVE";
  let extraHours = 0;

  if (elapsedMinutes >= contracted + record.graceMinutes + 1) {
    runtimeStatus = "OVERTIME";
    extraHours = Math.ceil((elapsedMinutes - contracted - record.graceMinutes) / 60);
  } else if (elapsedMinutes > contracted) {
    runtimeStatus = "GRACE";
  } else if (remainingMinutes <= record.warningMinutes) {
    runtimeStatus = "WARNING";
  }

  const calculatedExtraAmount = extraHours * Number(record.hourlyRate ?? 0);
  return {
    ...record,
    elapsedMinutes,
    remainingMinutes,
    runtimeStatus,
    extraHours,
    calculatedExtraAmount,
    calculatedTotalAmount: Number(record.baseAmount) + calculatedExtraAmount,
  };
}

function TimerCard({ record }: { record: ChildRecord }) {
  const [nowRecord, setNowRecord] = useState(() => calculateClientStatus(record));

  useEffect(() => {
    setNowRecord(calculateClientStatus(record));
    const id = setInterval(() => setNowRecord(calculateClientStatus(record)), 1000);
    return () => clearInterval(id);
  }, [record]);

  const cfg = statusConfig[nowRecord.runtimeStatus];
  const contracted = nowRecord.contractedMinutes ?? nowRecord.maxDuration ?? 0;
  const pct = contracted ? Math.min((nowRecord.elapsedMinutes / contracted) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className={cn("h-4 w-4", nowRecord.runtimeStatus === "OVERTIME" ? "text-red-500" : "text-muted-foreground")} />
          <span className="font-mono text-lg font-bold tabular-nums">{nowRecord.elapsedMinutes} min</span>
        </div>
        <Badge variant="outline" className={cn("text-xs", cfg.className)}>{cfg.label}</Badge>
      </div>
      {nowRecord.accessMode === "HOURLY" && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                nowRecord.runtimeStatus === "OVERTIME"
                  ? "bg-red-500"
                  : nowRecord.runtimeStatus === "WARNING"
                    ? "bg-amber-500"
                    : "bg-blue-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Contratado: {contracted} min</span>
            <span>Restante: {nowRecord.remainingMinutes ?? 0} min</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function ChildrenPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "CASHIER";
  const [active, setActive] = useState<ChildRecord[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [checkoutRecord, setCheckoutRecord] = useState<ChildRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);
  const [form, setForm] = useState({
    childName: "",
    childAge: "",
    guardianName: "",
    guardianPhone: "",
    accessMode: "HOURLY" as AccessMode,
    contractedMinutes: "60",
    hourlyRate: "120",
    freePrice: "0",
    orderMode: "new" as "new" | "existing",
    orderId: "",
    notes: "",
  });
  const [checkoutForm, setCheckoutForm] = useState({
    accessCode: "",
    guardianName: "",
    guardianPhone: "",
  });

  const resetForm = () => {
    setForm({
      childName: "",
      childAge: "",
      guardianName: "",
      guardianPhone: "",
      accessMode: "HOURLY",
      contractedMinutes: "60",
      hourlyRate: "120",
      freePrice: "0",
      orderMode: "new",
      orderId: "",
      notes: "",
    });
  };

  const loadActive = useCallback(() => {
    setLoadError(null);
    childAccessApi.getActive(branchId)
      .then(setActive)
      .catch(() => {
        setActive([]);
        setLoadError("No se pudo cargar el control infantil. Verifica que la API este disponible.");
      })
      .finally(() => setIsLoading(false));
  }, [branchId]);

  const loadOpenOrders = useCallback(() => {
    ordersApi.getAll({ branchId })
      .then((orders: OpenOrder[]) => {
        setOpenOrders(
          orders.filter((order) => !["COMPLETED", "CANCELLED"].includes(order.status)),
        );
      })
      .catch(() => setOpenOrders([]));
  }, [branchId]);

  const realtimeEvents = useMemo(() => ({
    "child_access.created": () => loadActive(),
    "child_access.updated": () => loadActive(),
    "child_access.status.changed": () => loadActive(),
    "child_access.completed": () => {
      loadActive();
      loadOpenOrders();
    },
    "order.payment_status.changed": () => loadOpenOrders(),
  }), [loadActive, loadOpenOrders]);
  const { status: realtimeStatus } = useRealtime(realtimeEvents);

  useEffect(() => {
    loadActive();
    loadOpenOrders();
    const id = setInterval(loadActive, 30000);
    return () => clearInterval(id);
  }, [loadActive, loadOpenOrders]);

  const liveRecords = useMemo(() => active.map(calculateClientStatus), [active]);
  const overtimeCount = liveRecords.filter((record) => record.runtimeStatus === "OVERTIME").length;
  const warningCount = liveRecords.filter((record) => record.runtimeStatus === "WARNING" || record.runtimeStatus === "GRACE").length;

  const handleRegister = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    try {
      await childAccessApi.register({
        childName: form.childName,
        childAge: form.childAge ? Number(form.childAge) : undefined,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone || undefined,
        accessMode: form.accessMode,
        contractedMinutes: form.accessMode === "HOURLY" ? Number(form.contractedMinutes) : undefined,
        maxDuration: form.accessMode === "HOURLY" ? Number(form.contractedMinutes) : undefined,
        hourlyRate: form.accessMode === "HOURLY" ? Number(form.hourlyRate) : undefined,
        freePrice: form.accessMode === "FREE" ? Number(form.freePrice) : undefined,
        orderId: form.orderMode === "existing" ? form.orderId : undefined,
        notes: form.notes || undefined,
      });
      setRegisterOpen(false);
      resetForm();
      loadActive();
      loadOpenOrders();
    } catch {
      setLoadError("No se pudo registrar la entrada. Revisa datos y permisos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (!checkoutRecord) return;
    setIsSubmitting(true);
    setLoadError(null);
    try {
      const result = await childAccessApi.checkout(checkoutRecord.id, checkoutForm);
      setCheckoutResult(result);
      setActive((prev) => prev.filter((record) => record.id !== checkoutRecord.id));
    } catch {
      setLoadError("No se pudo finalizar. Valida codigo, tutor y sucursal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Infantil"
        description="Registro, temporizador y cobro de tiempo extra"
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <RealtimeIndicator status={realtimeStatus} />
              <Button onClick={() => setRegisterOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Registrar niño
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Baby className="h-8 w-8 text-blue-600" />
            <div><p className="text-2xl font-bold">{liveRecords.length}</p><p className="text-xs text-muted-foreground">Activos</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-amber-600" />
            <div><p className="text-2xl font-bold">{warningCount}</p><p className="text-xs text-muted-foreground">Por vencer/tolerancia</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div><p className="text-2xl font-bold">{overtimeCount}</p><p className="text-xs text-muted-foreground">Excedidos</p></div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : liveRecords.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground"><Baby className="mb-3 h-12 w-12 opacity-30" /><p className="font-medium">No hay niños activos</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveRecords.map((child) => {
            const cfg = statusConfig[child.runtimeStatus];
            return (
              <Card key={child.id} className={cn("overflow-hidden", child.runtimeStatus === "OVERTIME" && "border-red-300")}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{child.childName}</p>
                      <p className="text-xs text-muted-foreground">{child.childAge ? `${child.childAge} años · ` : ""}{child.accessMode === "FREE" ? "Libre" : "Por hora"}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", cfg.className)}>{cfg.label}</Badge>
                  </div>
                  <TimerCard record={child} />
                  <div className="grid gap-2 rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tutor</span><span>{child.guardianName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Código</span><span className="font-mono font-bold">{child.accessCode}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ticket</span><span>{child.order?.orderNumber ?? "Sin ticket"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total estimado</span><span>{formatCurrency(child.calculatedTotalAmount)}</span></div>
                    {child.calculatedExtraAmount > 0 && (
                      <div className="flex justify-between text-red-600"><span>Extra</span><span>{formatCurrency(child.calculatedExtraAmount)}</span></div>
                    )}
                  </div>
                  {canManage && (
                    <div className="grid gap-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => {
                        setCheckoutRecord(child);
                        setCheckoutResult(null);
                        setCheckoutForm({ accessCode: "", guardianName: "", guardianPhone: "" });
                      }}>
                        <LogOut className="mr-1 h-3.5 w-3.5" />
                        Finalizar acceso
                      </Button>
                      {child.orderId && (
                        <Button asChild size="sm" variant="secondary" className="w-full">
                          <Link href={`/pos?orderId=${child.orderId}`}>Ir a cobrar</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Registrar ingreso</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Nombre del niño</Label><Input value={form.childName} onChange={(e) => setForm((p) => ({ ...p, childName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Edad</Label><Input type="number" min={0} value={form.childAge} onChange={(e) => setForm((p) => ({ ...p, childAge: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Tutor</Label><Input value={form.guardianName} onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Teléfono</Label><Input value={form.guardianPhone} onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.accessMode} onValueChange={(value: AccessMode) => setForm((p) => ({ ...p, accessMode: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="HOURLY">Por hora</SelectItem><SelectItem value="FREE">Libre</SelectItem></SelectContent>
                </Select>
              </div>
              {form.accessMode === "HOURLY" ? (
                <>
                  <div className="space-y-1.5"><Label>Minutos</Label><Input type="number" min={1} value={form.contractedMinutes} onChange={(e) => setForm((p) => ({ ...p, contractedMinutes: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Precio/hora</Label><Input type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))} /></div>
                </>
              ) : (
                <div className="space-y-1.5 sm:col-span-2"><Label>Precio libre</Label><Input type="number" min={0} value={form.freePrice} onChange={(e) => setForm((p) => ({ ...p, freePrice: e.target.value }))} /></div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ticket</Label>
                <Select value={form.orderMode} onValueChange={(value: "new" | "existing") => setForm((p) => ({ ...p, orderMode: value, orderId: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Crear ticket nuevo</SelectItem>
                    <SelectItem value="existing">Usar ticket abierto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.orderMode === "existing" && (
                <div className="space-y-1.5">
                  <Label>Orden abierta</Label>
                  <Select value={form.orderId} onValueChange={(value) => setForm((p) => ({ ...p, orderId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar ticket" /></SelectTrigger>
                    <SelectContent>
                      {openOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderNumber} - {formatCurrency(order.total)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>Observaciones</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegister} disabled={!form.childName || !form.guardianName || (form.orderMode === "existing" && !form.orderId) || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(checkoutRecord)} onOpenChange={(open) => !open && setCheckoutRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar acceso</DialogTitle></DialogHeader>
          {checkoutResult ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 p-3 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                Acceso finalizado correctamente
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between"><span>Base</span><span>{formatCurrency(checkoutResult.chargeSummary.baseAmount)}</span></div>
                <div className="flex justify-between"><span>Extra</span><span>{formatCurrency(checkoutResult.chargeSummary.extraAmount)}</span></div>
                <div className="mt-2 flex justify-between font-bold"><span>Total</span><span>{formatCurrency(checkoutResult.chargeSummary.totalAmount)}</span></div>
              </div>
              {checkoutResult.access?.orderId && (
                <Button asChild className="w-full">
                  <Link href={`/pos?orderId=${checkoutResult.access.orderId}`}>Ir a cobrar</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{checkoutRecord?.childName}</p>
                <p className="text-muted-foreground">Código: <span className="font-mono">{checkoutRecord?.accessCode}</span></p>
              </div>
              <div className="space-y-1.5"><Label>Código de salida</Label><Input value={checkoutForm.accessCode} onChange={(e) => setCheckoutForm((p) => ({ ...p, accessCode: e.target.value }))} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Tutor</Label><Input value={checkoutForm.guardianName} onChange={(e) => setCheckoutForm((p) => ({ ...p, guardianName: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Teléfono</Label><Input value={checkoutForm.guardianPhone} onChange={(e) => setCheckoutForm((p) => ({ ...p, guardianPhone: e.target.value }))} /></div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4" />
                Valida con código o con datos del tutor antes de finalizar.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutRecord(null)}>Cerrar</Button>
            {!checkoutResult && (
              <Button onClick={handleCheckout} disabled={isSubmitting || (!checkoutForm.accessCode && !checkoutForm.guardianName && !checkoutForm.guardianPhone)}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Finalizar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
