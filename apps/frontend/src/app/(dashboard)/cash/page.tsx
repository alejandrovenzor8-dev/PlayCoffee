"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarDays,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  Unlock,
  WalletCards,
} from "lucide-react";
import { cashApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type CashMovementType = "IN" | "OUT";

interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

interface CashShift {
  id: string;
  openingBalance: number;
  closingBalance: number | null;
  expectedCash: number;
  cashDifference: number | null;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalIn: number;
  totalOut: number;
  openedAt: string;
  closedAt: string | null;
  notes?: string;
  openedBy?: { firstName: string; lastName: string };
  movements: CashMovement[];
}

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function CashPage() {
  const [current, setCurrent] = useState<CashShift | null>(null);
  const [history, setHistory] = useState<CashShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType>("IN");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [openShift, shifts] = await Promise.all([
        cashApi.getCurrent(),
        cashApi.history(),
      ]);
      setCurrent(openShift);
      setHistory(shifts);
      setClosingBalance(openShift ? String(openShift.expectedCash.toFixed(2)) : "");
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar la caja",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const countedDifference = useMemo(() => {
    if (!current || closingBalance === "") return null;
    return Number(closingBalance) - current.expectedCash;
  }, [closingBalance, current]);

  const openShift = async () => {
    setActionLoading(true);
    try {
      await cashApi.open({
        openingBalance: Number(openingBalance),
        notes: openingNotes || undefined,
      });
      setOpeningBalance("0");
      setOpeningNotes("");
      await loadData();
      toast({ title: "Caja abierta", description: "El turno quedó activo" });
    } catch {
      toast({
        title: "No se pudo abrir caja",
        description: "Revisa que no exista un turno abierto",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const addMovement = async () => {
    if (!movementReason.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Agrega un motivo para el movimiento",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const updated = await cashApi.addMovement({
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason,
      });
      setCurrent(updated);
      setMovementAmount("");
      setMovementReason("");
      await loadData();
      toast({ title: "Movimiento registrado" });
    } catch {
      toast({
        title: "No se pudo registrar",
        description: "Debe existir una caja abierta y el monto debe ser válido",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const closeShift = async () => {
    setActionLoading(true);
    try {
      await cashApi.close({
        closingBalance: Number(closingBalance),
        notes: closingNotes || undefined,
      });
      setClosingNotes("");
      await loadData();
      toast({ title: "Caja cerrada", description: "Corte registrado correctamente" });
    } catch {
      toast({
        title: "No se pudo cerrar caja",
        description: "Verifica que exista un turno abierto",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Corte de Caja"
          description="Apertura, movimientos, arqueo y cierre del turno"
        />
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Caja actual</CardTitle>
            <Badge variant={current ? "default" : "secondary"}>
              {current ? "Abierta" : "Sin turno"}
            </Badge>
          </CardHeader>
          <CardContent>
            {!current ? (
              <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
                <div className="flex min-h-40 items-center justify-center rounded-md border bg-muted/30">
                  <Unlock className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Fondo inicial</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} rows={3} />
                  </div>
                  <Button onClick={openShift} disabled={actionLoading} className="w-full">
                    <Unlock className="mr-2 h-4 w-4" />
                    Abrir caja
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric icon={Banknote} label="Fondo inicial" value={currency.format(current.openingBalance)} />
                  <Metric icon={WalletCards} label="Ventas totales" value={currency.format(current.totalSales)} />
                  <Metric icon={Banknote} label="Efectivo esperado" value={currency.format(current.expectedCash)} />
                  <Metric icon={CalendarDays} label="Apertura" value={new Date(current.openedAt).toLocaleString("es-MX")} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric icon={Banknote} label="Efectivo" value={currency.format(current.totalCash)} />
                  <Metric icon={CreditCard} label="Tarjeta" value={currency.format(current.totalCard)} />
                  <Metric icon={WalletCards} label="Transferencia" value={currency.format(current.totalTransfer)} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-md border p-4">
                    <h3 className="text-sm font-semibold">Movimiento manual</h3>
                    <Select value={movementType} onValueChange={(value) => setMovementType(value as CashMovementType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">Entrada</SelectItem>
                        <SelectItem value="OUT">Salida</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Monto"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                    />
                    <Textarea
                      placeholder="Motivo"
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      rows={3}
                    />
                    <Button onClick={addMovement} disabled={actionLoading} className="w-full">
                      Registrar movimiento
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-md border p-4">
                    <h3 className="text-sm font-semibold">Cerrar caja</h3>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={closingBalance}
                      onChange={(e) => setClosingBalance(e.target.value)}
                    />
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <div className="flex justify-between">
                        <span>Diferencia</span>
                        <span className={cn(countedDifference && countedDifference < 0 ? "text-red-600" : "text-emerald-600")}>
                          {countedDifference === null ? "-" : currency.format(countedDifference)}
                        </span>
                      </div>
                    </div>
                    <Textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={3} placeholder="Notas de cierre" />
                    <Button variant="destructive" onClick={closeShift} disabled={actionLoading} className="w-full">
                      <Lock className="mr-2 h-4 w-4" />
                      Cerrar caja
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {current?.movements.length ? (
              current.movements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    {movement.type === "IN" ? (
                      <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{movement.reason}</p>
                      <p className="text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString("es-MX")}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{currency.format(movement.amount)}</span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos registrados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de cortes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {history.map((shift) => (
              <div key={shift.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-5 md:items-center">
                <div>
                  <p className="text-sm font-medium">{new Date(shift.openedAt).toLocaleDateString("es-MX")}</p>
                  <p className="text-xs text-muted-foreground">{shift.closedAt ? "Cerrado" : "Abierto"}</p>
                </div>
                <span className="text-sm">Ventas: {currency.format(shift.totalSales)}</span>
                <span className="text-sm">Efectivo: {currency.format(shift.expectedCash)}</span>
                <span className="text-sm">Contado: {shift.closingBalance === null ? "-" : currency.format(shift.closingBalance)}</span>
                <span className={cn("text-sm font-semibold", (shift.cashDifference ?? 0) < 0 ? "text-red-600" : "text-emerald-600")}>
                  Dif: {shift.cashDifference === null ? "-" : currency.format(shift.cashDifference)}
                </span>
              </div>
            ))}
            {!history.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay cortes registrados</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
