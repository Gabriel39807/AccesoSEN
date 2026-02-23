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
    // En dev esto ayuda a ver el error real en consola, aunque Turbopack muestre overlay genérico.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold tracking-wide text-emerald-700">SADI</div>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-zinc-900">
          Ocurrió un error inesperado
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Intenta recargar o volver a iniciar sesión. Si persiste, contacta soporte.
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
            className="rounded-2xl border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 text-center"
          >
            Ir a Iniciar Sesión
          </a>
        </div>

        <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
          <div className="text-xs font-semibold text-zinc-700">Detalle</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-600">
{process.env.NODE_ENV === "development"
  ? error.message
  : `Referencia: ${error.digest ?? ""}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
