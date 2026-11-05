"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cashApi, CASH_SHIFT_CHANGED, type CashClosingReminder as Reminder } from "@/lib/api";
import { canAccessModule } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";

export function CashClosingReminder() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessModule(user, "cash");
  const [state, setState] = useState<{ owner: string; reminder: Reminder | null; failed: boolean } | null>(null);
  const owner = `${user?.id}:${user?.branchId}`;
  const reminder = allowed && state?.owner === owner ? state.reminder : null;
  const failed = allowed && state?.owner === owner && state.failed;

  useEffect(() => {
    if (!allowed) return;
    let disposed = false;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try {
        const result = await cashApi.getClosingReminder();
        if (!disposed && request === revision) setState({ owner, reminder: result, failed: false });
      } catch {
        if (!disposed && request === revision) setState((previous) => ({
          owner, reminder: previous?.owner === owner ? previous.reminder : null, failed: true,
        }));
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = window.setInterval(onVisible, 30_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener(CASH_SHIFT_CHANGED, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener(CASH_SHIFT_CHANGED, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [allowed, owner]);

  useEffect(() => {
    if (!reminder) return;
    // Browsers show their own generic prompt; this cannot prevent a Windows shutdown.
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [reminder]);

  if (!reminder && !failed) return null;
  const overdue = reminder?.fromPreviousDay;
  return (
    <section role={overdue || failed ? "alert" : "status"} className={`shrink-0 border-b px-3 py-3 sm:px-6 ${overdue ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{reminder ? overdue ? "Cierre pendiente de un día anterior" : "Caja abierta: recuerda hacer el cierre" : "No se pudo verificar el cierre de caja"}</p>
          {reminder && <p>Abierta desde {new Date(reminder.openedAt).toLocaleString("es-MX", { timeZone: reminder.timezone })}. {overdue ? "Revisa el corte pendiente antes de iniciar la jornada." : "Realiza el corte antes de terminar el día o apagar el servidor."}</p>}
          {failed && <p>No hay confirmación actualizada del servidor. Revisa la conexión y verifica la caja antes de salir.</p>}
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/cash">Ir a Corte de Caja</Link></Button>
      </div>
    </section>
  );
}
