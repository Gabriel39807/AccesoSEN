"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida" | string;
  fecha: string;
  sede?: string | null;
  equipos?: number[];
};

type Equipo = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
};

type ApiErrorShape = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
    };
  };
};

function fmtFecha(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function tipoChip(tipo: string) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (tipo === "ingreso") return `${base} border-sky-200 bg-sky-50 text-sky-800`;
  if (tipo === "salida") return `${base} border-cyan-200 bg-cyan-50 text-cyan-800`;
  return `${base} border-zinc-200 bg-zinc-100 text-zinc-700`;
}

export default function AprendizHistorialPage() {
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [solo, setSolo] = useState<"todos" | "ingreso" | "salida">("todos");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const equiposById = useMemo(() => {
    const m = new Map<number, Equipo>();
    for (const e of equipos) m.set(e.id, e);
    return m;
  }, [equipos]);

  const tabs = [
    { key: "ingreso", label: "Entradas" },
    { key: "todos", label: "Todos" },
    { key: "salida", label: "Salidas" },
  ] as const;

  const cargar = useCallback(async (filters?: { solo: "todos" | "ingreso" | "salida"; dateFrom: string; dateTo: string }) => {
    const f = filters ?? { solo, dateFrom, dateTo };
    setLoading(true);
    setError(null);
    try {
      const equiposRes = await api.get("/api/equipos/");
      const equiposData = Array.isArray(equiposRes.data) ? equiposRes.data : equiposRes.data?.results ?? [];
      setEquipos(equiposData);

      const params: Record<string, string> = {};
      if (f.solo !== "todos") params.tipo = f.solo;
      if (f.dateFrom) params.date_from = f.dateFrom;
      if (f.dateTo) params.date_to = f.dateTo;

      const accesosRes = await api.get("/api/accesos/", { params });
      const data = Array.isArray(accesosRes.data) ? accesosRes.data : accesosRes.data?.results ?? [];
      setAccesos(data);
    } catch (e: unknown) {
      const err = e as ApiErrorShape;
      setError(err.response?.data?.detail ?? err.response?.data?.message ?? "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, solo]);

  useEffect(() => {
    const t = setTimeout(() => {
      void cargar({ solo, dateFrom, dateTo });
    }, 320);
    return () => clearTimeout(t);
  }, [solo, dateFrom, dateTo, cargar]);

  const resumen = useMemo(() => {
    const entradas = accesos.filter((a) => a.tipo === "ingreso").length;
    const salidas = accesos.filter((a) => a.tipo === "salida").length;
    return { entradas, salidas, total: accesos.length };
  }, [accesos]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">Historial de ingresos y salidas</h2>
            <p className="mt-1 text-sm text-zinc-600">Filtra por tipo o por rango de fechas para revisar movimientos.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => void cargar()}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              Recargar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-white/80 bg-white/70 p-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSolo(t.key)}
                  className={cx(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    solo === t.key
                      ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-[0_8px_18px_rgba(5,150,105,0.25)]"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:border-sky-200 hover:text-sky-700"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:col-span-7">
            <label className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-sm">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Desde</span>
              <input
                type="date"
                className="w-full bg-transparent text-sm text-zinc-700 outline-none"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>

            <label className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-sm">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Hasta</span>
              <input
                type="date"
                className="w-full bg-transparent text-sm text-zinc-700 outline-none"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entradas</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{loading ? "-" : resumen.entradas}</div>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Salidas</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{loading ? "-" : resumen.salidas}</div>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{loading ? "-" : resumen.total}</div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50/90 p-5 text-sm text-red-700">
          <div className="font-semibold">No pudimos cargar el historial.</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/75 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/80">
              <tr className="text-left text-zinc-700">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Sede</th>
                <th className="px-5 py-4 font-bold">Equipos</th>
              </tr>
            </thead>
            <tbody className="bg-white/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-5 py-4" colSpan={4}>
                      <div className="sadi-skeleton h-4 w-full max-w-xl rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : null}

              {!loading && accesos.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-zinc-500" colSpan={4}>
                    No hay registros para mostrar con los filtros seleccionados.
                  </td>
                </tr>
              ) : null}

              {!loading &&
                accesos.map((a) => {
                  const equiposDesc = (a.equipos ?? [])
                    .map((id) => {
                      const e = equiposById.get(id);
                      return e ? e.serial : `#${id}`;
                    })
                    .join(", ");

                  return (
                    <tr key={a.id} className="border-t border-zinc-100">
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">{fmtFecha(a.fecha)}</td>
                      <td className="px-5 py-4">
                        <span className={tipoChip(a.tipo)}>
                          {a.tipo === "ingreso" ? "Entrada" : a.tipo === "salida" ? "Salida" : a.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-700">{a.sede ?? "-"}</td>
                      <td className="px-5 py-4 text-zinc-700">{equiposDesc || "-"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

