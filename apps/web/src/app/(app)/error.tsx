"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En dev esto ayuda a ver el error real en consola, aunque Turbopack muestre overlay generico.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-3xl border border-surface-border bg-[color:var(--surface-elevated)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
        <div className="text-xs font-semibold tracking-wide text-emerald-700">SADI</div>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">Ocurrio un error inesperado</h2>
        <p className="mt-2 text-sm text-[color:var(--text-soft)]">
          Intenta recargar o volver a iniciar sesion. Si persiste, contacta soporte.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={reset}
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Reintentar
          </button>

          <a
            href="/login"
            className="rounded-2xl border border-surface-border bg-[color:var(--surface-muted)] px-5 py-2 text-center text-sm font-semibold text-[color:var(--text-soft)] hover:bg-[color:var(--surface-subtle)]"
          >
            Ir a Iniciar Sesion
          </a>
        </div>

        <div className="mt-5 rounded-2xl border border-surface-border bg-[color:var(--surface-muted)] p-4">
          <div className="text-xs font-semibold text-[color:var(--text-soft)]">Detalle</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-[color:var(--text-muted)]">
            {process.env.NODE_ENV === "development" ? error.message : `Referencia: ${error.digest ?? ""}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
