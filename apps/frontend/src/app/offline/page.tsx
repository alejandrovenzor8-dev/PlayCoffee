"use client";

import { Coffee, RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Coffee className="h-8 w-8" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-2 text-amber-700">
          <WifiOff className="h-5 w-5" />
          <span className="font-semibold">Servidor local no disponible</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-950">
          PlayCoffee está esperando conexión
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Verifica que la computadora principal y el router estén encendidos.
          Una caída de internet no debería detener el servicio dentro de la red
          local.
        </p>
        <button
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar la aplicación
        </button>
      </section>
    </main>
  );
}
