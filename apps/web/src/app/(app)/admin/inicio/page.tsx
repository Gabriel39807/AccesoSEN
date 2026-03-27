"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AdminOverviewCard, OverviewCardsContent } from "@/components/admin/dashboard/OverviewCards";
import {
  IconArrowRight,
  IconClock,
  IconHistory,
  IconLaptop,
  IconRefresh,
} from "@/components/aprendiz/dashboard/DashboardIcons";
import { useMe } from "@/hooks/useMe";
import { useSedes } from "@/hooks/useSedes";
import { api } from "@/lib/api";

type PeriodFilter = "Hoy" | "Semana" | "Mes" | "Anio";

type Paginated<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

type Usuario = {
  id: number;
  username: string;
  rol?: string;
  estado?: string | null;
  sede_principal?: string | null;
};

type Equipo = {
  id: number;
  estado?: string;
  propietario?: number;
};

type Acceso = {
  id: number;
  fecha: string;
  tipo: "ingreso" | "salida" | string;
  sede?: string | null;
  sede_name?: string | null;
  equipos?: number[];
};

type Turno = {
  id: number;
  activo: boolean;
  fin?: string | null;
};

type DashboardStats = {
  usersTotal: number;
  usersActive: number;
  pendingEquipos: number;
  accesosTotal: number;
  ingresosCount: number;
  salidasCount: number;
  accesosConEquipos: number;
  turnosActivos: number;
};

type ActivityItem = {
  id: number;
  title: string;
  meta: string;
  context: string;
  status: string;
  tone: "emerald" | "amber" | "sky" | "rose";
};

type TrendBar = {
  label: string;
  value: number;
  height: number;
};

const periodFilters: readonly PeriodFilter[] = ["Hoy", "Semana", "Mes", "Anio"];

const quickActions = [
  {
    title: "Revisar accesos",
    detail: "Validar eventos recientes, inconsistencias y cambios por sede.",
    icon: <IconHistory className="h-4 w-4" />,
    href: "/admin/accesos",
  },
  {
    title: "Aprobar equipos",
    detail: "Resolver solicitudes pendientes con trazabilidad completa.",
    icon: <IconLaptop className="h-4 w-4" />,
    href: "/admin/equipos",
  },
  {
    title: "Controlar turnos",
    detail: "Confirmar aperturas, cierres y coberturas del dia.",
    icon: <IconClock className="h-4 w-4" />,
    href: "/admin/turnos",
  },
] as const;

const initialStats: DashboardStats = {
  usersTotal: 0,
  usersActive: 0,
  pendingEquipos: 0,
  accesosTotal: 0,
  ingresosCount: 0,
  salidasCount: 0,
  accesosConEquipos: 0,
  turnosActivos: 0,
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toRows<T>(payload: T[] | Paginated<T> | undefined | null): T[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function toCount<T>(payload: T[] | Paginated<T> | undefined | null) {
  if (!payload) return 0;
  return Array.isArray(payload) ? payload.length : payload.count ?? payload.results?.length ?? 0;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentDateLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getPeriodRange(period: PeriodFilter) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  if (period === "Hoy") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "Semana") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === "Mes") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function formatRangeLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function relativeTime(iso?: string | null) {
  if (!iso) return "sin registro reciente";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "sin registro reciente";
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function buildTrend(rows: Acceso[], period: PeriodFilter, range: { start: Date; end: Date }): TrendBar[] {
  const currentYear = new Date().getFullYear();
  let buckets: Array<{ label: string; start: Date; end: Date; value: number }> = [];

  if (period === "Hoy") {
    buckets = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(range.start);
      start.setHours(index * 4, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 3, 59, 59, 999);
      return {
        label: `${String(start.getHours()).padStart(2, "0")}h`,
        start,
        end,
        value: 0,
      };
    });
  } else if (period === "Semana") {
    buckets = Array.from({ length: 7 }, (_, index) => {
      const start = new Date(range.start);
      start.setDate(range.start.getDate() + index);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(start).replace(".", ""),
        start,
        end,
        value: 0,
      };
    });
  } else if (period === "Mes") {
    const monthEnd = new Date(range.end);
    buckets = Array.from({ length: 5 }, (_, index) => {
      const start = new Date(range.start);
      start.setDate(1 + index * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (end > monthEnd) end.setTime(monthEnd.getTime());
      return {
        label: `Sem ${index + 1}`,
        start,
        end,
        value: 0,
      };
    }).filter((bucket) => bucket.start <= monthEnd);
  } else {
    buckets = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(currentYear, index, 1, 0, 0, 0, 0);
      const end = new Date(currentYear, index + 1, 0, 23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(start).replace(".", ""),
        start,
        end,
        value: 0,
      };
    });
  }

  rows.forEach((row) => {
    const date = new Date(row.fecha);
    if (Number.isNaN(date.getTime())) return;
    const bucket = buckets.find((item) => date >= item.start && date <= item.end);
    if (bucket) bucket.value += 1;
  });

  const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 1);
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
    height: Math.max(36, Math.round((bucket.value / maxValue) * 136)),
  }));
}

function buildActivity(rows: Acceso[], sedesByCode: Map<string, string>) {
  return rows.slice(0, 4).map((row) => {
    const isIngreso = row.tipo === "ingreso";
    const sedeLabel = row.sede_name || (row.sede ? sedesByCode.get(String(row.sede)) : null) || "Sin sede";
    return {
      id: row.id,
      title: isIngreso ? "Ingreso registrado" : "Salida registrada",
      meta: `${sedeLabel} - ${relativeTime(row.fecha)}`,
      context: row.equipos?.length ? "Incluye equipo asociado" : "Trazabilidad institucional",
      status: row.equipos?.length ? "Con equipo" : isIngreso ? "Validado" : "Trazado",
      tone: row.equipos?.length ? "emerald" : isIngreso ? "sky" : "amber",
    } satisfies ActivityItem;
  });
}

function toneClasses(tone: "emerald" | "amber" | "sky" | "rose") {
  if (tone === "emerald") return "command-noir-chip";
  if (tone === "amber") return "command-noir-chip";
  if (tone === "sky") return "command-noir-chip";
  return "command-noir-chip";
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("sadi-card-strong rounded-[1.3rem] p-3.5 md:p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">{eyebrow}</p>
          <h2 className="mt-1 text-[1.18rem] font-bold tracking-tight text-[color:var(--color-text)] sm:text-[1.3rem]">{title}</h2>
          {description ? <p className="mt-1.5 max-w-2xl text-sm leading-snug text-[color:var(--color-text-soft)]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminInicioPage() {
  const { me, loadingMe } = useMe();
  const { sedes } = useSedes();

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("Mes");
  const [selectedSede, setSelectedSede] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [overviewCards, setOverviewCards] = useState<AdminOverviewCard[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [trend, setTrend] = useState<TrendBar[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const sedesByCode = useMemo(() => new Map(sedes.map((item) => [item.code, item.name])), [sedes]);
  const periodRange = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod]);
  const canChooseSede = me?.rol === "superadmin";
  const effectiveSede = canChooseSede ? selectedSede : me?.sede_principal ?? "";

  useEffect(() => {
    if (me?.rol !== "superadmin") {
      setSelectedSede(me?.sede_principal ?? "");
    }
  }, [me?.rol, me?.sede_principal]);

  useEffect(() => {
    if (!me) return;
    let mounted = true;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError(null);

      try {
        const usersParams: Record<string, string | number> = { page: 1, page_size: 200 };
        const equiposParams: Record<string, string | number> = { page: 1, page_size: 200, estado: "pendiente" };
        const accesosParams: Record<string, string | number> = {
          page: 1,
          page_size: 240,
          date_from: isoDate(periodRange.start),
          date_to: isoDate(periodRange.end),
        };
        const turnosParams: Record<string, string | number> = { page: 1, page_size: 120, activo: "true" };

        if (effectiveSede) {
          usersParams.sede_principal = effectiveSede;
          accesosParams.sede = effectiveSede;
          turnosParams.sede = effectiveSede;
        }

        const [usersRes, equiposPendingRes, accesosRes, turnosActivosRes] = await Promise.all([
          api.get<Usuario[] | Paginated<Usuario>>("/api/usuarios/", { params: usersParams }),
          api.get<Equipo[] | Paginated<Equipo>>("/api/equipos/", { params: equiposParams }),
          api.get<Acceso[] | Paginated<Acceso>>("/api/accesos/", { params: accesosParams }),
          api.get<Turno[] | Paginated<Turno>>("/api/turnos/", { params: turnosParams }),
        ]);

        if (!mounted) return;

        const usersRows = toRows(usersRes.data);
        const usersMap = new Map(usersRows.map((user) => [user.id, user]));
        const equiposPendingRows = toRows(equiposPendingRes.data);
        const pendingEquiposFiltered = effectiveSede
          ? equiposPendingRows.filter((equipo) => usersMap.get(Number(equipo.propietario))?.sede_principal === effectiveSede)
          : equiposPendingRows;
        const accesosRows = toRows(accesosRes.data)
          .filter((row) => {
            const rowDate = new Date(row.fecha);
            return !Number.isNaN(rowDate.getTime()) && rowDate >= periodRange.start && rowDate <= periodRange.end;
          })
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        const turnosActivosRows = toRows(turnosActivosRes.data).filter((turno) => turno.activo && !turno.fin);

        const nextStats: DashboardStats = {
          usersTotal: toCount(usersRes.data),
          usersActive: usersRows.filter((user) => String(user.estado ?? "").toLowerCase() !== "bloqueado").length,
          pendingEquipos: pendingEquiposFiltered.length,
          accesosTotal: accesosRows.length,
          ingresosCount: accesosRows.filter((row) => row.tipo === "ingreso").length,
          salidasCount: accesosRows.filter((row) => row.tipo === "salida").length,
          accesosConEquipos: accesosRows.filter((row) => (row.equipos?.length ?? 0) > 0).length,
          turnosActivos: turnosActivosRows.length,
        };

        setStats(nextStats);
        setTrend(buildTrend(accesosRows, selectedPeriod, periodRange));
        setActivity(buildActivity(accesosRows, sedesByCode));
        setLastUpdatedAt(new Date());
        setOverviewCards([
          {
            label: `Accesos en ${selectedPeriod.toLowerCase()}`,
            value: nextStats.accesosTotal.toLocaleString("es-CO"),
            delta: `${nextStats.ingresosCount} ingresos`,
            caption: `${nextStats.salidasCount} salidas trazadas en el rango activo.`,
            icon: "history",
            tone: "dark",
          },
          {
            label: "Usuarios visibles",
            value: nextStats.usersTotal.toLocaleString("es-CO"),
            delta: `${nextStats.usersActive} activos`,
            caption: effectiveSede ? "Alcance filtrado por sede." : "Vista consolidada segun tu alcance administrativo.",
            icon: "user",
            tone: "sky",
          },
          {
            label: "Equipos pendientes",
            value: nextStats.pendingEquipos.toLocaleString("es-CO"),
            delta: "Revision abierta",
            caption: "Solicitudes de equipos por validar en el panel.",
            icon: "laptop",
            tone: "emerald",
          },
          {
            label: "Turnos activos",
            value: nextStats.turnosActivos.toLocaleString("es-CO"),
            delta: "Tiempo real",
            caption: "Cobertura actualmente en curso para control de acceso.",
            icon: "clock",
            tone: "violet",
          },
        ]);
      } catch (error: any) {
        if (!mounted) return;
        setDashboardError(
          error?.response?.data?.detail ?? error?.response?.data?.motivo ?? error?.message ?? "No se pudo cargar la informacion operativa."
        );
        setOverviewCards([]);
        setActivity([]);
        setTrend([]);
        setStats(initialStats);
        setLastUpdatedAt(null);
      } finally {
        if (mounted) setDashboardLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [effectiveSede, me, periodRange, refreshKey, sedesByCode, selectedPeriod]);

  if (loadingMe) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="animate-pulse font-medium text-zinc-500">Cargando panel...</p>
      </div>
    );
  }

  const sede = effectiveSede || me?.sede_principal || "Sede principal";
  const isSuperadmin = me?.rol === "superadmin";
  const roleLabel = isSuperadmin ? "Superadmin global" : "Administrador de sede";
  const activePeriodLabel = dashboardLoading ? "Actualizando" : `${stats.ingresosCount} ingresos - ${stats.salidasCount} salidas`;
  const lastUpdatedLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastUpdatedAt)
    : "Pendiente";

  const priorityItems = [
    {
      title: isSuperadmin ? "Sedes bajo supervision" : "Sede activa",
      detail: isSuperadmin
        ? effectiveSede
          ? `Supervision concentrada en ${sedesByCode.get(String(sede)) || sede}.`
          : "Revisa rapidamente donde hace falta intervenir antes de bajar a modulos."
        : `${sedesByCode.get(String(sede)) || sede} es tu foco operativo principal.`,
      href: isSuperadmin ? "/admin/control-center" : "/admin/accesos",
      cta: isSuperadmin ? "Ir al centro de control" : "Ver accesos",
      tone: "sky" as const,
    },
    {
      title: `${stats.pendingEquipos} equipos pendientes`,
      detail:
        stats.pendingEquipos > 0
          ? "Hay solicitudes que requieren validacion para no frenar el flujo operativo."
          : "No hay aprobaciones pendientes en este momento.",
      href: "/admin/equipos",
      cta: "Gestionar equipos",
      tone: stats.pendingEquipos > 0 ? ("amber" as const) : ("emerald" as const),
    },
    {
      title: `${stats.turnosActivos} turnos activos`,
      detail:
        stats.turnosActivos > 0
          ? "Confirma cobertura y cierres esperados para evitar huecos de vigilancia."
          : "No hay turnos activos ahora mismo; valida si esto es esperado.",
      href: "/admin/turnos",
      cta: "Revisar turnos",
      tone: stats.turnosActivos > 0 ? ("emerald" as const) : ("rose" as const),
    },
    {
      title: `${stats.accesosConEquipos} accesos con equipo`,
      detail:
        stats.accesosTotal > 0
          ? `${activePeriodLabel}. Usalo para detectar actividad atipica o trazabilidad incompleta.`
          : "Aun no hay accesos suficientes para analizar el comportamiento del periodo.",
      href: "/admin/accesos",
      cta: "Auditar actividad",
      tone: "sky" as const,
    },
  ];

  const recommendedFocus =
    stats.pendingEquipos > 0
      ? {
          title: "Despeja aprobaciones pendientes",
          detail: `${stats.pendingEquipos} solicitudes requieren validacion para evitar cuellos de botella.`,
          href: "/admin/equipos",
          cta: "Ir a equipos",
        }
      : stats.turnosActivos === 0
        ? {
            title: "Valida la cobertura actual",
            detail: "No hay turnos activos visibles. Confirma si el estado operativo es el esperado.",
            href: "/admin/turnos",
            cta: "Revisar turnos",
          }
        : {
            title: "Audita el flujo del periodo",
            detail: `${stats.accesosTotal.toLocaleString("es-CO")} accesos visibles en ${selectedPeriod.toLowerCase()}. Usa esta lectura para detectar desbalances.`,
            href: "/admin/accesos",
            cta: "Abrir accesos",
          };

  const pulseItems = [
    {
      label: "Cobertura",
      value: `${stats.turnosActivos}`,
      detail: stats.turnosActivos > 0 ? "turnos en curso" : "sin turnos activos",
    },
    {
      label: "Trazabilidad",
      value: `${formatCompactNumber(stats.accesosConEquipos)}`,
      detail: stats.accesosConEquipos > 0 ? "accesos con equipo" : "sin enlaces a equipos",
    },
    {
      label: "Usuarios",
      value: `${formatCompactNumber(stats.usersActive)}`,
      detail: `${stats.usersTotal.toLocaleString("es-CO")} visibles`,
    },
  ];

  return (
    <div className="min-w-0 space-y-4 2xl:space-y-5">
      <section className="sadi-card-strong rounded-[1.75rem] p-5 xl:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Panel de control</p>
            <div>
              <h1 className="text-[1.95rem] font-bold tracking-tight text-[color:var(--color-text)] xl:text-[2.25rem]">Estado operativo {isSuperadmin ? "institucional" : "de tu sede"}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--color-text-soft)]">
                Prioriza lo que requiere atencion, entra al modulo correcto y resuelve sin perder tiempo entre widgets decorativos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--color-text-soft)]">
              <span className="command-noir-chip px-3 py-1.5 font-medium">
                {sedesByCode.get(String(sede)) || sede}
              </span>
              <span className="command-noir-chip px-3 py-1.5">
                {roleLabel}
              </span>
              <span className="command-noir-chip px-3 py-1.5 font-medium">
                {dashboardLoading ? "Sincronizando" : `Actualizado ${lastUpdatedLabel}`}
              </span>
            </div>
          </div>

          <div className="grid w-full gap-2.5 xl:max-w-[336px]">
            <Link
              href={recommendedFocus.href}
              className="rounded-[1.3rem] border border-[color:var(--color-border-strong)] bg-[linear-gradient(180deg,rgba(111,211,255,0.12),rgba(255,255,255,0.02))] px-4 py-3.5 transition hover:border-[color:var(--color-primary)] hover:bg-[linear-gradient(180deg,rgba(111,211,255,0.16),rgba(255,255,255,0.03))]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Siguiente foco</p>
              <p className="mt-1.5 text-base font-semibold text-[color:var(--color-text)]">{recommendedFocus.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-text-soft)]">{recommendedFocus.detail}</p>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text)]">
                {recommendedFocus.cta}
                <IconArrowRight className="h-4 w-4" />
              </div>
            </Link>

            <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-[color:var(--color-border-strong)] bg-[color:var(--surface-subtle)] px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Periodo activo</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">{formatRangeLabel(periodRange.start, periodRange.end)}</p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{activePeriodLabel}</p>
            </div>
            <div className="rounded-[1.2rem] border border-[color:var(--color-border-strong)] bg-[color:var(--surface-subtle)] px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Hoy</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">{currentDateLabel()}</p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">Vista pensada para supervision y respuesta.</p>
            </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {pulseItems.map((item) => (
                <div key={item.label} className="rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--color-text)]">{item.value}</p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {periodFilters.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                  period === selectedPeriod
                    ? "border-[color:var(--color-primary)] bg-[color:var(--primary-soft)] text-[color:var(--color-text)] shadow-[0_0_0_1px_rgba(111,211,255,0.18)_inset]"
                    : "border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] text-[color:var(--color-text-soft)] hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--surface-muted)]",
                )}
              >
                {period}
              </button>
            ))}
          </div>

          <div className="grid w-full gap-2.5 sm:grid-cols-[minmax(220px,1fr),auto,auto] xl:max-w-[500px]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Sede</span>
              <select
                value={canChooseSede ? selectedSede : me?.sede_principal ?? ""}
                onChange={(event) => setSelectedSede(event.target.value)}
                disabled={!canChooseSede}
                className="command-noir-control w-full rounded-2xl px-3 py-2 text-sm font-medium text-[color:var(--color-text)] outline-none transition disabled:cursor-not-allowed disabled:opacity-80"
              >
                {canChooseSede ? <option value="" className="text-zinc-900">Todas las sedes</option> : null}
                {sedes.map((item) => (
                  <option key={item.code} value={item.code} className="text-zinc-900">
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-3 py-2.5 text-sm font-semibold text-[color:var(--color-text)] transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)]"
            >
              <IconRefresh className={cx("h-4 w-4", dashboardLoading && "animate-spin")} />
              {dashboardLoading ? "Actualizando..." : "Refrescar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedPeriod("Mes");
                setSelectedSede(isSuperadmin ? "" : me?.sede_principal ?? "");
                setRefreshKey((value) => value + 1);
              }}
              className="inline-flex items-center justify-center rounded-[1.2rem] border border-[color:var(--color-border-strong)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-sm font-semibold text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)]"
            >
              Restablecer
            </button>
          </div>
        </div>
      </section>

      {dashboardError ? (
        <div className="rounded-[1.7rem] border border-[color:rgba(255,107,122,0.28)] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] px-5 py-4 text-sm text-[color:var(--danger)] shadow-sm">
          <span className="font-semibold">No pudimos actualizar todo el panel.</span> {dashboardError}
        </div>
      ) : null}

      <OverviewCardsContent cards={overviewCards} loading={dashboardLoading} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
        <SectionCard
          eyebrow="Prioridades"
          title="Que requiere atencion ahora"
          description={isSuperadmin
            ? "Empieza por las excepciones y luego baja al modulo correspondiente."
            : "Estas son las decisiones que mas impacto tienen hoy en tu sede."}
        >
          <div className="mt-3 grid gap-2.5">
            {priorityItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex flex-col gap-2.5 rounded-[1.2rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3.5 py-3 transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-text)]">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">{item.detail}</p>
                  </div>
                  <span className={toneClasses(item.tone)} data-tone={item.tone === "emerald" ? "success" : item.tone === "amber" ? "warning" : item.tone === "rose" ? "danger" : "info"}>
                    Prioridad
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text)]">
                  {item.cta}
                  <IconArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Actividad"
          title="Eventos recientes"
          description="Ultimos movimientos visibles en el rango activo para validar trazabilidad y detectar desviaciones."
        >
          <div className="mt-3 overflow-hidden rounded-[1.2rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)]">
            <div className="hidden grid-cols-[minmax(0,1.15fr),minmax(140px,0.45fr),minmax(120px,0.35fr)] border-b border-[color:var(--color-border)] bg-[color:var(--surface-muted)] px-3.5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] md:grid">
              <span>Evento</span>
              <span>Contexto</span>
              <span>Estado</span>
            </div>
            {dashboardLoading ? (
              <div className="divide-y divide-[color:var(--color-border)]">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2.5 px-3 py-3 md:grid-cols-[minmax(0,1.15fr),minmax(140px,0.45fr),minmax(120px,0.35fr)]">
                    <div className="space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.08)]" />
                      <div className="h-3 w-52 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.06)]" />
                    </div>
                    <div className="h-3 w-28 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.06)]" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.07)]" />
                  </div>
                ))}
              </div>
            ) : activity.length ? (
              <div className="divide-y divide-[color:var(--color-border)]">
              {activity.map((item) => (
                <div key={`${item.id}-${item.title}`} className="grid grid-cols-1 items-start gap-2.5 px-3 py-3 md:grid-cols-[minmax(0,1.15fr),minmax(140px,0.45fr),minmax(120px,0.35fr)] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--color-text)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{item.meta}</p>
                  </div>
                  <div className="text-sm text-[color:var(--color-text-soft)]">{item.context}</div>
                  <div>
                    <span className={toneClasses(item.tone)} data-tone={item.tone === "emerald" ? "success" : item.tone === "amber" ? "warning" : item.tone === "rose" ? "danger" : "info"}>{item.status}</span>
                  </div>
                </div>
              ))}
              </div>
            ) : (
              <div className="grid min-h-[220px] place-items-center p-6 text-center">
                <div className="max-w-sm">
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">Todavia no hay eventos recientes en este rango</p>
                  <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Amplia el periodo o cambia la sede para revisar si hay actividad historica que requiera seguimiento.</p>
                  <Link href="/admin/accesos" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text)]">
                    Ir al modulo de accesos
                    <IconArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
        <SectionCard
          eyebrow="Monitoreo"
          title="Tendencia del periodo"
          description="Una sola visual util: volumen de accesos para entender carga operativa sin distraer la lectura principal."
        >
          <div className="mt-3 rounded-[1.2rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text)]">Actividad por {selectedPeriod.toLowerCase()}</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{activePeriodLabel}</p>
              </div>
              <span className="command-noir-chip px-3 py-1 text-xs font-semibold">
                {formatRangeLabel(periodRange.start, periodRange.end)}
              </span>
            </div>

            {dashboardLoading ? (
              <div className={cx("grid items-end gap-3", selectedPeriod === "Anio" ? "grid-cols-6" : "grid-cols-5")}>
                {Array.from({ length: selectedPeriod === "Anio" ? 6 : 5 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end justify-center rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-2.5 py-2.5">
                      <div className="w-10 animate-pulse rounded-full bg-[color:rgba(111,211,255,0.18)]" style={{ height: `${40 + index * 10}px` }} />
                    </div>
                    <div className="h-3 w-10 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.06)]" />
                    <div className="h-3 w-6 animate-pulse rounded-full bg-[color:rgba(255,255,255,0.05)]" />
                  </div>
                ))}
              </div>
            ) : trend.length ? (
              <div className={cx("grid items-end gap-3", trend.length <= 5 ? "grid-cols-5" : "grid-cols-6")}>
                {trend.map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end justify-center rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-2.5 py-2.5">
                      <div className="w-10 rounded-full bg-[linear-gradient(180deg,rgba(111,211,255,0.96),rgba(79,163,255,0.58))] shadow-[0_0_18px_rgba(111,211,255,0.22)]" style={{ height: `${Math.max(28, item.height)}px` }} />
                    </div>
                    <span className="text-xs font-semibold text-[color:var(--color-text-muted)]">{item.label}</span>
                    <span className="text-[11px] text-[color:var(--color-text-muted)]">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[220px] place-items-center rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-6 text-center">
                <div className="max-w-sm">
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">No hay suficiente actividad para graficar</p>
                  <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Cambia el periodo o la sede para ver comportamiento operativo.</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            eyebrow="Acciones"
            title="Entradas rapidas"
            description="Atajos directos para resolver pendientes sin navegar de mas."
          >
            <div className="mt-3 space-y-2.5">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="flex items-start gap-3 rounded-[1.15rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)]"
                >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.03)] text-[color:var(--color-text)] shadow-sm">
                    {action.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[color:var(--color-text)]">{action.title}</p>
                      <IconArrowRight className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">{action.detail}</p>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Contexto"
            title="Resumen del enfoque actual"
            description="Informacion minima para orientarte sin llenar la pantalla de widgets redundantes."
          >
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Usuarios visibles</p>
                <p className="mt-1.5 text-[1.35rem] font-bold text-[color:var(--color-text)]">{stats.usersTotal}</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{stats.usersActive} activos dentro del alcance actual.</p>
              </div>
              <div className="rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Trazabilidad</p>
                <p className="mt-1.5 text-[1.35rem] font-bold text-[color:var(--color-text)]">{stats.accesosConEquipos}</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">Accesos con equipo asociado en el periodo activo.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
