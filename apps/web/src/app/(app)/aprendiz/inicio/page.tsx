"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/components/aprendiz/dashboard/EmptyState";
import {
  IconBell,
  IconClock,
  IconHelp,
  IconHistory,
  IconLaptop,
  IconShield,
} from "@/components/aprendiz/dashboard/DashboardIcons";
import QuickActionCard from "@/components/aprendiz/dashboard/QuickActionCard";
import SectionCard from "@/components/aprendiz/dashboard/SectionCard";
import SkeletonBlock from "@/components/aprendiz/dashboard/SkeletonBlock";
import StatCard from "@/components/aprendiz/dashboard/StatCard";
import StatusChip from "@/components/aprendiz/dashboard/StatusChip";
import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";

type Equipo = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado" | string;
  motivo_rechazo?: string | null;
};

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida" | string;
  fecha: string;
  sede?: string | null;
  equipos?: number[];
};

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS";
  ultimo_tipo?: "ingreso" | "salida" | null;
  ultima_fecha?: string | null;
};

type ApiErrorShape = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
    };
  };
};

function fmt(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function equipoStateClasses(state: string) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (state === "aprobado") return `${base} border-sky-200 bg-sky-50 text-sky-800`;
  if (state === "rechazado") return `${base} border-red-200 bg-red-50 text-red-700`;
  return `${base} border-amber-200 bg-amber-50 text-amber-800`;
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

export default function AprendizInicioPage() {
  const { me, loadingMe } = useMe();

  const [estado, setEstado] = useState<EstadoResponse | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [estadoRes, equiposRes, accesosRes] = await Promise.all([
        api.get<EstadoResponse>("/api/accesos/estado/"),
        api.get("/api/equipos/"),
        api.get("/api/accesos/mis_accesos/"),
      ]);

      setEstado(estadoRes.data);

      const equiposData = Array.isArray(equiposRes.data) ? equiposRes.data : equiposRes.data?.results ?? [];
      setEquipos(equiposData);

      const accesosData = Array.isArray(accesosRes.data) ? accesosRes.data : accesosRes.data?.results ?? [];
      setAccesos(accesosData);
    } catch (e: unknown) {
      const err = e as ApiErrorShape;
      setError(err.response?.data?.detail ?? err.response?.data?.message ?? "No se pudo cargar tu panel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const onRefresh = () => {
      cargar();
    };
    window.addEventListener("aprendiz:refresh", onRefresh);
    return () => {
      window.removeEventListener("aprendiz:refresh", onRefresh);
    };
  }, []);

  const stats = useMemo(() => {
    const total = equipos.length;
    const aprobados = equipos.filter((e) => e.estado === "aprobado").length;
    const pendientes = equipos.filter((e) => e.estado === "pendiente").length;
    const rechazados = equipos.filter((e) => e.estado === "rechazado").length;
    return { total, aprobados, pendientes, rechazados };
  }, [equipos]);

  const equiposPreview = useMemo(() => equipos.slice(0, 4), [equipos]);
  const accesosPreview = useMemo(() => accesos.slice(0, 5), [accesos]);

  const nombreBonito =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Resumen de hoy</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">
              {loadingMe ? "Cargando..." : nombreBonito || "Aprendiz"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {me?.programa_formacion ?? ""}
              {me?.sede_principal ? ` - ${me.sede_principal}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusChip status={estado?.estado} labelPrefix="Estado actual" />
            <p className="text-xs text-zinc-500">Último registro: {fmt(estado?.ultima_fecha)}</p>
            <button
              onClick={cargar}
              className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              Actualizar panel
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700">
            <div className="font-semibold">No pudimos cargar la información.</div>
            <div className="mt-1">{error}</div>
            <button
              onClick={cargar}
              className="mt-3 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Reintentar
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Equipos registrados" value={stats.total} icon={<IconLaptop className="h-5 w-5" />} loading={loading} />
        <StatCard label="Aprobados" value={stats.aprobados} icon={<IconShield className="h-5 w-5" />} loading={loading} tone="ok" />
        <StatCard label="Pendientes" value={stats.pendientes} icon={<IconClock className="h-5 w-5" />} loading={loading} tone="warn" />
        <StatCard label="Rechazados" value={stats.rechazados} icon={<IconBell className="h-5 w-5" />} loading={loading} tone="danger" />
      </section>

      <SectionCard title="Accesos rápidos" subtitle="Atajos para tus tareas más usadas">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <QuickActionCard
            href="/aprendiz/equipos/nuevo"
            title="Registrar nuevo equipo"
            description="Carga marca, modelo y serial para iniciar validación."
            icon={<IconLaptop className="h-5 w-5" />}
            featured
          />
          <QuickActionCard
            href="/aprendiz/accesos"
            title="Historial de ingresos"
            description="Consulta tus últimos movimientos y sedes."
            icon={<IconHistory className="h-5 w-5" />}
          />
          <QuickActionCard
            href="/aprendiz/ayuda"
            title="Ayuda y soporte"
            description="Encuentra respuestas y contacto de soporte."
            icon={<IconHelp className="h-5 w-5" />}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <SectionCard
            title="Mis equipos"
            subtitle="Vista rápida de tus equipos más recientes"
            className="h-full"
            action={
              <Link href="/aprendiz/equipos" className="text-sm font-semibold text-sky-700 transition hover:text-sky-800">
                Ver todos
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/90 bg-white/90 p-4">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="mt-2 h-3 w-1/2" />
                  <SkeletonBlock className="mt-4 h-6 w-20" />
                </div>
              ))
            ) : null}

            {!loading && equiposPreview.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyState
                  title="Aún no tienes equipos registrados"
                  description="Registra tu primer equipo para poder gestionar ingresos y salidas."
                  actionLabel="Registrar equipo"
                  actionHref="/aprendiz/equipos/nuevo"
                />
              </div>
            ) : null}

            {!loading &&
              equiposPreview.map((eq) => {
                const ubi = ubicacionPorAccesos(eq.id, accesos);
                return (
                  <Link
                    key={eq.id}
                    href={`/aprendiz/equipos/${eq.id}`}
                    className="group rounded-2xl border border-white/90 bg-white/90 p-4 shadow-[0_8px_18px_rgba(2,6,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(2,6,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {eq.marca} {eq.modelo}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">Serial: {eq.serial}</div>
                      </div>
                      <span className={equipoStateClasses(eq.estado)}>{eq.estado}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusChip status={ubi} />
                      {eq.estado === "rechazado" && eq.motivo_rechazo ? (
                        <span className="text-xs text-red-700">{eq.motivo_rechazo}</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-6">
          <SectionCard
            title="Notificaciones recientes"
            subtitle="Tus últimos accesos y avisos del sistema"
            className="h-full"
            action={
              <Link href="/aprendiz/accesos" className="text-sm font-semibold text-sky-700 transition hover:text-sky-800">
                Ver historial
              </Link>
            }
          >
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/90 bg-white/90 p-4">
                    <SkeletonBlock className="h-4 w-3/5" />
                    <SkeletonBlock className="mt-2 h-3 w-2/5" />
                  </div>
                ))
              ) : null}

              {!loading && accesosPreview.length === 0 ? (
                <EmptyState
                  title="No hay movimientos recientes"
                  description="Cuando registres ingresos o salidas aparecerán en esta sección."
                />
              ) : null}

              {!loading &&
                accesosPreview.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-[0_6px_16px_rgba(2,6,23,0.04)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-900">
                        {a.tipo === "ingreso" ? "Ingreso registrado" : "Salida registrada"}
                      </div>
                      <div className="text-xs text-zinc-500">{fmt(a.fecha)}</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">{a.sede ? `Sede: ${a.sede}` : "Sede sin registrar"}</div>
                  </div>
                ))}

              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50/90 to-sky-50/90 p-4 text-sm text-zinc-700">
                <span className="font-semibold">Recordatorio:</span> actualiza tus datos en la sección Mi perfil.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
