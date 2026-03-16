"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS" | "dentro" | "fuera" | string;
};

function normalizeEstado(raw?: string | null): "DENTRO" | "FUERA" | "SIN_REGISTROS" {
  const value = String(raw ?? "SIN_REGISTROS").trim().toUpperCase();
  if (value === "DENTRO") return "DENTRO";
  if (value === "FUERA") return "FUERA";
  return "SIN_REGISTROS";
}

function estadoLabel(value: "DENTRO" | "FUERA" | "SIN_REGISTROS" | null) {
  if (value === "DENTRO") return "Dentro del centro";
  if (value === "FUERA") return "Fuera del centro";
  return "Sin registros recientes";
}

function estadoDescription(value: "DENTRO" | "FUERA" | "SIN_REGISTROS" | null) {
  if (value === "DENTRO") return "Tu último movimiento registrado fue un ingreso.";
  if (value === "FUERA") return "Tu último movimiento registrado fue una salida.";
  return "Aún no hay movimientos recientes asociados a tu cuenta.";
}

export default function AprendizEstadoPage() {
  const [estado, setEstado] = useState<"DENTRO" | "FUERA" | "SIN_REGISTROS" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<EstadoResponse>("/api/accesos/estado/");
      setEstado(normalizeEstado(res.data?.estado));
    } catch (e: unknown) {
      setError(toErrorMessage(e, "No se pudo cargar el estado."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const color =
    estado === "DENTRO"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : estado === "FUERA"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-zinc-200 bg-zinc-100 text-zinc-800";

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

      {loading ? <p className="text-sm text-zinc-500">Cargando estado...</p> : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className={`rounded-3xl border p-6 ${color}`}>
          <p className="text-sm opacity-80">Estado actual</p>
          <p className="mt-1 text-3xl font-extrabold">{estadoLabel(estado)}</p>
          <p className="mt-2 text-sm opacity-80">{estadoDescription(estado)}</p>
        </div>
      ) : null}
    </div>
  );
}
