"use client";

import { Bell, Coffee, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuthStore } from "@/store/auth.store";
import { canAccessModule, type ModuleKey } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((state) => state.user);
  const [alerts, setAlerts] = useState<Array<{ text: string; href: string; time: string }>>([]);
  const events = useMemo(() => {
    const announce = (text: string, href: string, module: ModuleKey) => () => {
      if (!canAccessModule(user, module)) return;
      setAlerts((current) => [{ text, href, time: new Date().toLocaleTimeString() }, ...current].slice(0, 30));
    };
    return {
      "order.created": announce("Nueva comanda: revisar cocina y barra", "/orders", "orders"),
      "order.sent_to_kitchen": announce("Comanda enviada o productos agregados", "/orders", "orders"),
      "order.updated": announce("Cambió el estado de una comanda", "/orders", "orders"),
      "order.cancelled": announce("Comanda cancelada", "/orders", "orders"),
      "payment.created": announce("Pago registrado", "/cash", "cash"),
      "child_access.created": announce("Nuevo ingreso al área infantil", "/child-access", "child-access"),
      "child_access.completed": announce("Salida infantil registrada; revisar cobro", "/child-access", "child-access"),
    };
  }, [user]);
  const { status } = useRealtime(events);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-3 backdrop-blur sm:h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 lg:hidden">
          <Coffee className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          {!title && <p className="truncate text-sm font-bold lg:hidden">PlayCoffee</p>}
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 w-64 h-9" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" aria-label="Notificaciones">
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 text-sm font-semibold">
              Notificaciones · {status === "connected" ? "En línea" : "Reconectando"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.length > 0 ? <div className="max-h-80 overflow-y-auto p-2">
              <Button variant="ghost" size="sm" onClick={() => setAlerts([])}>Marcar como leídas</Button>
              {alerts.map((alert, index) => <Link key={`${alert.time}-${index}`} href={alert.href} className="block rounded p-3 text-sm hover:bg-muted">
                <p>{alert.text}</p><time className="text-xs text-muted-foreground">{alert.time}</time>
              </Link>)}
            </div> : <div className="px-4 py-5 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Sin notificaciones nuevas</p>
              <p className="mt-1 text-xs leading-5">
                Las alertas operativas apareceran aqui cuando haya eventos pendientes.
              </p>
            </div>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
