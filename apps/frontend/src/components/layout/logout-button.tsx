"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cashApi } from "@/lib/api";
import { canAccessModule } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth.store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function LogoutButton() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const logout = async () => {
    if (!canAccessModule(user, "cash")) { clearAuth(); return; }
    setChecking(true);
    try {
      const pending = await cashApi.getClosingReminder();
      if (pending) {
        setMessage("Hay una caja abierta sin corte registrado. Cerrar sesión no cierra la caja. Si terminaste la jornada, realiza el cierre antes de salir.");
      } else { clearAuth(); }
    } catch {
      setMessage("No se pudo consultar el estado de la caja. Verifica la conexión y el corte antes de terminar la jornada; cerrar sesión no cierra la caja.");
    } finally { setChecking(false); }
  };

  return <>
    <button onClick={logout} disabled={checking} className="rounded p-1.5 opacity-50 transition-opacity hover:bg-white/10 hover:opacity-100 disabled:opacity-30" title="Cerrar sesión" aria-label="Cerrar sesión">
      <LogOut className="h-4 w-4" />
    </button>
    <AlertDialog open={Boolean(message)} onOpenChange={(open) => { if (!open) setMessage(""); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Revisa el cierre de caja</AlertDialogTitle><AlertDialogDescription>{message}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={clearAuth}>Salir sin cerrar caja</AlertDialogAction>
          <AlertDialogAction onClick={() => router.push("/cash")}>Ir al corte</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
