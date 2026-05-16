"use client";

import { useEffect, useState, useCallback } from "react";
import { childAccessApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Baby, UserPlus, LogOut, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
      const diff = Math.floor((Date.now() - new Date(entryTime).getTime()) / 1000);
      setElapsed(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [entryTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = maxDuration ? Math.min((elapsed / 60 / maxDuration) * 100, 100) : 0;
  const isOvertime = maxDuration ? mins >= maxDuration : false;
  const isWarning = maxDuration ? mins >= maxDuration * 0.85 : false;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Clock className={cn("h-4 w-4", isOvertime ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
        <span className={cn("font-mono font-bold text-lg tabular-nums", isOvertime ? "text-red-600" : isWarning ? "text-amber-600" : "")}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        {isOvertime && <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />}
      </div>
      {maxDuration && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", isOvertime ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {maxDuration && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Límite: {maxDuration} min
        </p>
      )}
    </div>
  );
}

export default function ChildrenPage() {
  const [active, setActive] = useState<ChildRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const loadActive = useCallback(() => {
    childAccessApi.getActive()
      .then(setActive)
      .catch(() => {
        // Mock data
        setActive([
          {
            id: "ca1",
            childName: "Mateo García",
            childAge: 6,
            guardianName: "Laura García",
            guardianPhone: "555-0101",
            entryTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            maxDuration: 120,
            braceletId: "B-001",
          },
          {
            id: "ca2",
            childName: "Sofía López",
            childAge: 8,
            guardianName: "Carlos López",
            guardianPhone: "555-0102",
            entryTime: new Date(Date.now() - 115 * 60 * 1000).toISOString(),
            maxDuration: 120,
            braceletId: "B-002",
          },
          {
            id: "ca3",
            childName: "Diego Martínez",
            childAge: 5,
            guardianName: "Ana Martínez",
            guardianPhone: "555-0103",
            entryTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            maxDuration: 90,
          },
        ]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadActive();
    const id = setInterval(loadActive, 30000);
    return () => clearInterval(id);
  }, [loadActive]);

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      await childAccessApi.register({
        childName: form.childName,
        childAge: form.childAge ? Number(form.childAge) : undefined,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        maxDuration: form.maxDuration ? Number(form.maxDuration) : undefined,
        braceletId: form.braceletId || undefined,
      });
      setRegisterOpen(false);
      setForm({ childName: "", childAge: "", guardianName: "", guardianPhone: "", maxDuration: "120", braceletId: "" });
      loadActive();
    } catch {
      // Optimistically add to list for demo
      setActive((prev) => [...prev, {
        id: `ca-${Date.now()}`,
        childName: form.childName,
        childAge: form.childAge ? Number(form.childAge) : undefined,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        entryTime: new Date().toISOString(),
        maxDuration: form.maxDuration ? Number(form.maxDuration) : undefined,
        braceletId: form.braceletId || undefined,
      }]);
      setRegisterOpen(false);
      setForm({ childName: "", childAge: "", guardianName: "", guardianPhone: "", maxDuration: "120", braceletId: "" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async (id: string) => {
    try {
      await childAccessApi.checkout(id);
    } catch { /* ignore */ }
    setActive((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Infantil"
        description="Gestión del área de juegos y tiempo de permanencia"
        actions={
          <Button onClick={() => setRegisterOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Registrar Niño
          </Button>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-36">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Baby className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{active.length}</p>
              <p className="text-xs text-muted-foreground">Niños activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-36">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {active.filter((r) => r.maxDuration && (Date.now() - new Date(r.entryTime).getTime()) / 60000 >= r.maxDuration).length}
              </p>
              <p className="text-xs text-muted-foreground">Tiempo vencido</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active children grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Baby className="h-12 w-12 opacity-30 mb-3" />
            <p className="font-medium">No hay niños registrados</p>
            <p className="text-sm opacity-70 mt-1">Registra el ingreso de un niño para comenzar</p>
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
                  <div className="bg-red-500 px-4 py-1 text-xs font-semibold text-white flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    ¡Tiempo vencido! Favor de llamar al tutor
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">👦</span>
                        <div>
                          <p className="font-semibold">{child.childName}</p>
                          {child.childAge && (
                            <p className="text-xs text-muted-foreground">{child.childAge} años</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {child.braceletId && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {child.braceletId}
                      </Badge>
                    )}
                  </div>

                  <ElapsedTimer entryTime={child.entryTime} maxDuration={child.maxDuration} />

                  <div className="rounded-lg bg-muted p-3 space-y-1">
                    <p className="text-xs font-medium">Tutor responsable</p>
                    <p className="text-sm">{child.guardianName}</p>
                    <p className="text-xs text-muted-foreground">{child.guardianPhone}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleCheckout(child.id)}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    Registrar Salida
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Register dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Ingreso</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre del niño *</Label>
                <Input
                  placeholder="Nombre completo"
                  value={form.childName}
                  onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Edad (años)</Label>
                <Input
                  type="number"
                  placeholder="Ej: 6"
                  min={0}
                  max={17}
                  value={form.childAge}
                  onChange={(e) => setForm((f) => ({ ...f, childAge: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre del tutor *</Label>
              <Input
                placeholder="Nombre del responsable"
                value={form.guardianName}
                onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono del tutor *</Label>
              <Input
                placeholder="555-0000"
                value={form.guardianPhone}
                onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tiempo máximo (min)</Label>
                <Input
                  type="number"
                  placeholder="120"
                  min={30}
                  value={form.maxDuration}
                  onChange={(e) => setForm((f) => ({ ...f, maxDuration: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ID Pulsera</Label>
                <Input
                  placeholder="B-001"
                  value={form.braceletId}
                  onChange={(e) => setForm((f) => ({ ...f, braceletId: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRegister}
              disabled={!form.childName || !form.guardianName || !form.guardianPhone || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
