"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS";
};

export default function AprendizEstadoPage() {
  const [estado, setEstado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<EstadoResponse>("/api/accesos/estado/");
      setEstado(res.data?.estado ?? "SIN_REGISTROS");
    } catch (e: unknown) {
      setError(toErrorMessage(e, "No se pudo cargar el estado."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const color =
    estado === "DENTRO"
      ? "bg-green-100 text-green-800 border-green-200"
      : estado === "FUERA"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900">Estado actual</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Consulta si estás dentro o fuera del centro.
            </p>
          </div>

          <button
            onClick={cargar}
            className="rounded-full border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Recargar
          </button>
        </div>
      </div>

      {loading && <p>Cargando estado...</p>}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className={`rounded-3xl border p-6 ${color}`}>
          <p className="text-sm opacity-80">Estado actual</p>
          <p className="mt-1 text-3xl font-extrabold">{estado}</p>
        </div>
      )}
    </div>
  );
}
