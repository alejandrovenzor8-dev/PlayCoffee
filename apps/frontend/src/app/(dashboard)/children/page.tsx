"use client";

import { useCallback, useEffect, useState } from "react";
import { childAccessApi } from "@/lib/api";
import { getActiveBranchId } from "@/lib/branch";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Baby, Clock, Loader2, LogOut, UserPlus } from "lucide-react";

interface ChildRecord {
  id: string;
  childName: string;
  childAge?: number;
  guardianName: string;
  guardianPhone: string;
  entryTime: string;
  exitTime?: string;
  maxDuration?: number;
  braceletId?: string;
}

function ElapsedTimer({ entryTime, maxDuration }: { entryTime: string; maxDuration?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(entryTime).getTime()) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [entryTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = maxDuration ? Math.min((mins / maxDuration) * 100, 100) : 0;
  const isOvertime = maxDuration ? mins >= maxDuration : false;
  const isWarning = maxDuration ? mins >= maxDuration * 0.85 : false;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Clock className={cn("h-4 w-4", isOvertime ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
        <span className={cn("font-mono text-lg font-bold tabular-nums", isOvertime ? "text-red-600" : isWarning ? "text-amber-600" : "")}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        {isOvertime && <AlertTriangle className="h-4 w-4 animate-pulse text-red-500" />}
      </div>
      {maxDuration && (
        <>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", isOvertime ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Limite: {maxDuration} min</p>
        </>
      )}
    </div>
  );
}

export default function ChildrenPage() {
  const { user } = useAuthStore();
  const branchId = getActiveBranchId(user);
  const [active, setActive] = useState<ChildRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    childName: "",
    childAge: "",
    guardianName: "",
    guardianPhone: "",
    maxDuration: "120",
    braceletId: "",
  });

  const resetForm = () => {
    setForm({
      childName: "",
      childAge: "",
      guardianName: "",
      guardianPhone: "",
      maxDuration: "120",
      braceletId: "",
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

  useEffect(() => {
    loadActive();
    const id = setInterval(loadActive, 30000);
    return () => clearInterval(id);
  }, [loadActive]);

  const handleRegister = async () => {
    setIsSubmitting(true);
    setLoadError(null);
    try {
      await childAccessApi.register({
        branchId,
        childName: form.childName,
        childAge: form.childAge ? Number(form.childAge) : undefined,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        maxDuration: form.maxDuration ? Number(form.maxDuration) : undefined,
        braceletId: form.braceletId || undefined,
      });
      setRegisterOpen(false);
      resetForm();
      loadActive();
    } catch {
      setLoadError("No se pudo registrar la entrada. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async (id: string) => {
    setLoadError(null);
    try {
      await childAccessApi.checkout(id, branchId);
      setActive((prev) => prev.filter((record) => record.id !== id));
    } catch {
      setLoadError("No se pudo registrar la salida. Intenta de nuevo.");
    }
  };

  const overtimeCount = active.filter((record) =>
    record.maxDuration && (Date.now() - new Date(record.entryTime).getTime()) / 60000 >= record.maxDuration
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Infantil"
        description="Gestion del area de juegos y tiempo de permanencia"
        actions={
          <Button onClick={() => setRegisterOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Registrar Nino
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Card className="min-w-36 flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Baby className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{active.length}</p>
              <p className="text-xs text-muted-foreground">Ninos activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-36 flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{overtimeCount}</p>
              <p className="text-xs text-muted-foreground">Tiempo vencido</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Baby className="mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium">No hay ninos registrados</p>
            <p className="mt-1 text-sm opacity-70">Registra el ingreso de un nino para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((child) => {
            const elapsed = Math.floor((Date.now() - new Date(child.entryTime).getTime()) / 60000);
            const isOvertime = child.maxDuration ? elapsed >= child.maxDuration : false;
            return (
              <Card key={child.id} className={cn("overflow-hidden", isOvertime && "border-red-400 ring-1 ring-red-400/50")}>
                {isOvertime && (
                  <div className="flex items-center gap-1 bg-red-500 px-4 py-1 text-xs font-semibold text-white">
                    <AlertTriangle className="h-3 w-3" />
                    Tiempo vencido. Favor de llamar al tutor.
                  </div>
                )}
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{child.childName}</p>
                      {child.childAge && <p className="text-xs text-muted-foreground">{child.childAge} anos</p>}
                    </div>
                    {child.braceletId && <Badge variant="outline" className="text-xs font-mono">{child.braceletId}</Badge>}
                  </div>
                  <ElapsedTimer entryTime={child.entryTime} maxDuration={child.maxDuration} />
                  <div className="space-y-1 rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium">Tutor responsable</p>
                    <p className="text-sm">{child.guardianName}</p>
                    <p className="text-xs text-muted-foreground">{child.guardianPhone}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleCheckout(child.id)}>
                    <LogOut className="mr-1 h-3.5 w-3.5" />
                    Registrar Salida
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar Ingreso</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre del nino *</Label>
                <Input value={form.childName} onChange={(event) => setForm((prev) => ({ ...prev, childName: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Edad</Label>
                <Input type="number" min={0} max={17} value={form.childAge} onChange={(event) => setForm((prev) => ({ ...prev, childAge: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre del tutor *</Label>
              <Input value={form.guardianName} onChange={(event) => setForm((prev) => ({ ...prev, guardianName: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefono del tutor *</Label>
              <Input value={form.guardianPhone} onChange={(event) => setForm((prev) => ({ ...prev, guardianPhone: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tiempo maximo (min)</Label>
                <Input type="number" min={30} value={form.maxDuration} onChange={(event) => setForm((prev) => ({ ...prev, maxDuration: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>ID Pulsera</Label>
                <Input value={form.braceletId} onChange={(event) => setForm((prev) => ({ ...prev, braceletId: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegister} disabled={!form.childName || !form.guardianName || !form.guardianPhone || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
