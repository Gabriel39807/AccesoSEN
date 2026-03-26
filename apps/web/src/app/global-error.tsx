"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
          <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">SADI</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Ocurrio un error inesperado</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Recarga la pagina o vuelve a iniciar sesion. Si el problema continua, comparte la referencia con soporte.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Reintentar
              </button>
              <a
                href="/login"
                className="rounded-2xl border border-zinc-200 px-5 py-2 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Ir a inicio de sesion
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
