import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          PlayCoffee OS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
          Sistema iniciado correctamente
        </h1>
        <p className="mt-3 text-zinc-600">
          Ya no estas viendo la plantilla de Next.js. Usa estos accesos para entrar al flujo
          principal de la app.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            Ir a Login
          </Link>
          <Link
            href="/pos"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
          >
            Ir a POS
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Backend esperado en http://localhost:3001 y frontend en http://localhost:3000.
        </p>
      </main>
    </div>
  );
}
