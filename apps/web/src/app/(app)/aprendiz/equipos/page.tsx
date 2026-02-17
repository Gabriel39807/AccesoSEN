"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

type Equipo = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado" | string;
  motivo_rechazo?: string | null;
  revisado_en?: string | null;
};

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida" | string;
  fecha: string;
  equipos?: number[];
};

function badgeEstado(estado: string) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (estado === "aprobado") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  if (estado === "rechazado") return `${base} border-red-200 bg-red-50 text-red-800`;
  return `${base} border-amber-200 bg-amber-50 text-amber-900`;
}

function badgeUbicacion(ubi: "DENTRO" | "FUERA" | "SIN_REGISTROS") {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (ubi === "DENTRO") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  if (ubi === "FUERA") return `${base} border-cyan-200 bg-cyan-50 text-cyan-800`;
  return `${base} border-zinc-200 bg-zinc-100 text-zinc-700`;
}

function ubicacionPorAccesos(equipoId: number, accesos: Acceso[]): "DENTRO" | "FUERA" | "SIN_REGISTROS" {
  for (const a of accesos) {
    if (!Array.isArray(a.equipos)) continue;
    if (!a.equipos.includes(equipoId)) continue;
    if (a.tipo === "ingreso") return "DENTRO";
    if (a.tipo === "salida") return "FUERA";
  }
  return "SIN_REGISTROS";
}

export default function AprendizEquiposPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendiente" | "aprobado" | "rechazado">("todos");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [equiposRes, accesosRes] = await Promise.all([api.get("/api/equipos/"), api.get("/api/accesos/mis_accesos/")]);

      const equiposData = Array.isArray(equiposRes.data) ? equiposRes.data : equiposRes.data?.results ?? [];
      setEquipos(equiposData);

      const accesosData = Array.isArray(accesosRes.data) ? accesosRes.data : accesosRes.data?.results ?? [];
      setAccesos(accesosData);
    } catch (e: unknown) {
      setError(toErrorMessage(e, "No se pudieron cargar tus equipos."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    return equipos
      .filter((e) => {
        if (filtro !== "todos" && e.estado !== filtro) return false;
        if (!query) return true;
        return (
          (e.serial ?? "").toLowerCase().includes(query) ||
          (e.marca ?? "").toLowerCase().includes(query) ||
          (e.modelo ?? "").toLowerCase().includes(query)
        );
      })
      .map((e) => ({
        ...e,
        ubicacion: ubicacionPorAccesos(e.id, accesos),
      }));
  }, [equipos, accesos, filtro, q]);

  const resumen = useMemo(() => {
    const pendientes = filtrados.filter((e) => e.estado === "pendiente").length;
    const aprobados = filtrados.filter((e) => e.estado === "aprobado").length;
    return { total: filtrados.length, pendientes, aprobados };
  }, [filtrados]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">Mis equipos</h2>
            <p className="mt-1 text-sm text-zinc-600">Registra y consulta tus equipos autorizados para ingreso y salida.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/aprendiz/equipos/nuevo"
              className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)] transition hover:brightness-105"
            >
              Registrar nuevo
            </Link>
            <button
              onClick={() => void cargar()}
              className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              Recargar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-12">
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 xl:col-span-5"
            placeholder="Buscar por serial, marca o modelo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 xl:col-span-3"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as "todos" | "pendiente" | "aprobado" | "rechazado")}
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          <div className="grid grid-cols-3 gap-2 xl:col-span-4">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total</div>
              <div className="text-lg font-extrabold text-zinc-900">{loading ? "-" : resumen.total}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Aprobados</div>
              <div className="text-lg font-extrabold text-zinc-900">{loading ? "-" : resumen.aprobados}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Pendientes</div>
              <div className="text-lg font-extrabold text-zinc-900">{loading ? "-" : resumen.pendientes}</div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50/90 p-5 text-sm text-red-700">
          <div className="font-semibold">No pudimos cargar tus equipos.</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-white/80 bg-white/80 p-5">
              <div className="sadi-skeleton h-4 w-2/3 rounded-lg" />
              <div className="sadi-skeleton mt-2 h-3 w-1/2 rounded-lg" />
              <div className="sadi-skeleton mt-4 h-6 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((e) => (
            <Link
              key={e.id}
              href={`/aprendiz/equipos/${e.id}`}
              className="group rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_8px_20px_rgba(2,6,23,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(2,6,23,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-extrabold text-zinc-900">
                    {e.marca} {e.modelo}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Serial: {e.serial}</div>
                </div>
                <span className={badgeEstado(e.estado)}>{e.estado}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={badgeUbicacion(e.ubicacion)}>
                  {e.ubicacion === "SIN_REGISTROS" ? "Sin movimientos" : e.ubicacion}
                </span>
                {e.estado === "rechazado" && e.motivo_rechazo ? <span className="text-xs font-semibold text-red-700">{e.motivo_rechazo}</span> : null}
              </div>

              <div className="mt-4 text-xs font-semibold text-emerald-700 transition group-hover:translate-x-0.5">Ver detalles {'>'}</div>
            </Link>
          ))}

          {filtrados.length === 0 ? (
            <div className="sm:col-span-2 xl:col-span-3 rounded-3xl border border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-cyan-50/60 p-8 text-center text-sm text-zinc-600">
              <p className="font-semibold text-zinc-900">No hay equipos para mostrar con los filtros actuales.</p>
              <p className="mt-1">Prueba cambiando el filtro o registra un equipo nuevo.</p>
              <Link
                href="/aprendiz/equipos/nuevo"
                className="mt-4 inline-flex rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Registrar equipo
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
