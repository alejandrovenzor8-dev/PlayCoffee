"use client";

import { cn } from "@/lib/utils";
import { RealtimeStatus } from "@/lib/socket";

const labels: Record<RealtimeStatus, string> = {
  connected: "Conectado",
  reconnecting: "Reconectando",
  disconnected: "Sin realtime",
};

const colors: Record<RealtimeStatus, string> = {
  connected: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  disconnected: "bg-slate-400",
};

export function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", colors[status])} />
      {labels[status]}
    </div>
  );
}
