"use client";

import { useEffect, useMemo, useState } from "react";

import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import Button from "@/components/dashboard/shared/Button";
import { IconClock } from "@/components/aprendiz/dashboard/DashboardIcons";
import FormBanner from "@/components/feedback/FormBanner";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import { parseApiError } from "@/lib/apiError";
import { useSedes } from "@/hooks/useSedes";

type Usuario = {
  id: number;
  username: string;
  rol: "admin" | "guarda" | "aprendiz" | string;
  first_name?: string;
  last_name?: string;
};

type Turno = {
  id: number;
  guarda: number;
  sede: string;
  jornada: "MANANA" | "MAÑANA" | "TARDE" | "NOCHE";
  inicio: string;
  fin: string | null;
  activo: boolean;
};

const JORNADAS: Turno["jornada"][] = ["MANANA", "MAÑANA", "TARDE", "NOCHE"];

function badgeBase() {
  return "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
}

function badgeEstado(turno: Turno) {
  const isActivo = turno.activo && !turno.fin;
  return isActivo
    ? `${badgeBase()} border-emerald-200 bg-emerald-100 text-emerald-800`
    : `${badgeBase()} border-zinc-200 bg-zinc-100 text-zinc-700`;
}

function badgeJornada(j: Turno["jornada"]) {
  if (j === "MANANA" || j === "MAÑANA") return `${badgeBase()} border-sky-200 bg-sky-100 text-sky-800`;
  if (j === "TARDE") return `${badgeBase()} border-amber-200 bg-amber-100 text-amber-800`;
  return `${badgeBase()} border-indigo-200 bg-indigo-100 text-indigo-800`;
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "—";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function formatFecha(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normalizarJornada(j: Turno["jornada"]) {
  return j === "MANANA" || j === "MAÑANA" ? "Mañana" : j === "TARDE" ? "Tarde" : "Noche";
}

function safeErrorMessage(e: any) {
  return parseApiError(e).message;
}

function StatSkeleton() {
  return <div className="h-[92px] animate-pulse rounded-2xl border bg-white p-4 shadow-sm" />;
}

function FilterSkeleton() {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
      </div>
    </section>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/80 shadow-[0_10px_28px_rgba(2,6,23,0.06)]">
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

export default function AdminTurnosPage() {
  const { sedes } = useSedes();
  const sedesByCode = useMemo(() => new Map(sedes.map((item) => [item.code, item.name])), [sedes]);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sede, setSede] = useState<string>("");
  const [jornada, setJornada] = useState<"" | Turno["jornada"]>("");
  const [activo, setActivo] = useState<"" | "true" | "false">("");
  const [guardaId, setGuardaId] = useState<number | "">("");

  const [openFinalizar, setOpenFinalizar] = useState(false);
  const [turnoFinalizar, setTurnoFinalizar] = useState<Turno | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const usuariosMap = useMemo(() => {
    const m = new Map<number, Usuario>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const guardas = useMemo(() => usuarios.filter((u) => u.rol === "guarda"), [usuarios]);

  const rows = useMemo(() => {
    let r = [...turnos];
    if (guardaId !== "") r = r.filter((t) => t.guarda === guardaId);
    return r;
  }, [turnos, guardaId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activosCount = rows.filter((t) => t.activo && !t.fin).length;
    const finalizados = rows.filter((t) => !t.activo || !!t.fin).length;
    return { total, activos: activosCount, finalizados };
  }, [rows]);

  const hasFilters = sede !== "" || jornada !== "" || activo !== "" || guardaId !== "";
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  async function cargarUsuarios() {
    const res = await api.get("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    setUsuarios(data);
  }

  async function cargarTurnos() {
    const params: any = {};
    if (sede) params.sede = sede;
    if (jornada) params.jornada = jornada;
    if (activo) params.activo = activo;

    const res = await api.get("/api/turnos/", { params });
    const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    setTurnos(data);
  }

  async function cargarBase() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([cargarUsuarios(), cargarTurnos()]);
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function refrescar() {
    setReloading(true);
    setError(null);
    try {
      await cargarTurnos();
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setReloading(false);
    }
  }

  function resetFiltros() {
    setSede("");
    setJornada("");
    setActivo("");
    setGuardaId("");
    setPage(1);
  }

  function abrirFinalizar(t: Turno) {
    setTurnoFinalizar(t);
    setOpenFinalizar(true);
  }

  async function confirmarFinalizar() {
    if (!turnoFinalizar) return;
    setFinalizando(true);
    setError(null);

    try {
      const res = await api.post(`/api/turnos/${turnoFinalizar.id}/finalizar_admin/`);
      if (res?.data?.permitido === false) {
        setError(String(res?.data?.motivo || "No se pudo finalizar el turno. Verifica permisos o estado del turno y vuelve a intentar."));
        return;
      }
      setOpenFinalizar(false);
      setTurnoFinalizar(null);
      await cargarTurnos();
    } catch (e: any) {
      setError(safeErrorMessage(e) || "No se pudo finalizar el turno. Revisa tu conexión e intenta nuevamente.");
      await cargarTurnos();
    } finally {
      setFinalizando(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-7 pb-2">
      <PageHeader
        breadcrumb="ADMIN > TURNOS"
        title="Turnos"
        description="Control de turnos de guardas y finalizacion manual por administrador."
        actions={
          <Button onClick={refrescar} variant="secondary" disabled={reloading}>
            {reloading ? "Recargando..." : "Recargar"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Activos" value={stats.activos} tone="success" />
            <StatCard label="Finalizados" value={stats.finalizados} tone="neutral" />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar
          footer={
            error ? <FormBanner type="error" message={error} /> : null
          }
        >
          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-3"
            value={sede}
            onChange={(e) => setSede(e.target.value as any)}
          >
            <option value="">Sede</option>
            {sedes.map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-3"
            value={jornada}
            onChange={(e) => setJornada(e.target.value as any)}
          >
            <option value="">Jornada</option>
            {JORNADAS.map((j) => (
              <option key={j} value={j}>
                {normalizarJornada(j)}
              </option>
            ))}
          </select>

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-2"
            value={activo}
            onChange={(e) => setActivo(e.target.value as any)}
          >
            <option value="">Activo (API)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-2"
            value={guardaId}
            onChange={(e) => setGuardaId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Guarda</option>
            {guardas.map((g) => (
              <option key={g.id} value={g.id}>
                {nombreUsuario(g)}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-end gap-2 md:col-span-6 lg:col-span-2">
            <Button
              onClick={() => {
                setPage(1);
                cargarTurnos().catch(() => setError("No se pudieron cargar los turnos."));
              }}
              variant="primary"
            >
              Aplicar
            </Button>
            <Button
              onClick={() => {
                resetFiltros();
                setTimeout(() => cargarTurnos().catch(() => {}), 0);
              }}
              variant="secondary"
              disabled={!hasFilters}
            >
              Limpiar
            </Button>
          </div>

          <div className="flex h-11 items-center justify-end md:col-span-12 lg:col-span-2">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 whitespace-nowrap">
              {rows.length} turnos
            </span>
          </div>
        </FilterBar>
      )}

      <div className="space-y-4">
        <DataTable
          loading={loading}
          skeleton={<TableSkeleton />}
          hasRows={pagedRows.length > 0}
          tableClassName="min-w-[980px]"
          headers={
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Guarda</th>
              <th className="px-4 py-3 font-semibold">Sede</th>
              <th className="px-4 py-3 font-semibold">Jornada</th>
              <th className="px-4 py-3 font-semibold">Inicio</th>
              <th className="px-4 py-3 font-semibold">Fin</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          }
          emptyState={
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <EmptyState
                    title="No hay turnos con los filtros actuales"
                    description="Ajusta filtros para ver resultados."
                    icon={<IconClock className="h-5 w-5" />}
                  />
                </div>
              </td>
            </tr>
          }
        >
          {pagedRows.map((t) => {
            const u = usuariosMap.get(t.guarda) ?? null;
            const isActivo = t.activo && !t.fin;

            return (
              <tr key={t.id} className="transition hover:bg-sky-50/35">
                <td className="px-4 py-3 font-semibold text-gray-900">#{t.id}</td>
                <td className="px-4 py-3 text-gray-800">{nombreUsuario(u)}</td>
                <td className="px-4 py-3 text-gray-800">{sedesByCode.get(t.sede) || t.sede}</td>
                <td className="px-4 py-3">
                  <span className={badgeJornada(t.jornada)}>{normalizarJornada(t.jornada)}</span>
                </td>
                <td className="px-4 py-3 text-gray-800">{formatFecha(t.inicio)}</td>
                <td className="px-4 py-3 text-gray-800">{formatFecha(t.fin)}</td>
                <td className="px-4 py-3">
                  <span className={badgeEstado(t)}>{isActivo ? "Activo" : "Finalizado"}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    onClick={() => abrirFinalizar(t)}
                    disabled={!isActivo}
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                  >
                    Finalizar
                  </Button>
                </td>
              </tr>
            );
          })}
        </DataTable>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={rows.length}
          pageSize={pageSize}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>

      <Modal
        open={openFinalizar}
        title="Finalizar turno (Admin)"
        onClose={() => {
          if (finalizando) return;
          setOpenFinalizar(false);
          setTurnoFinalizar(null);
        }}
        closeDisabled={finalizando}
      >
        {turnoFinalizar ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-zinc-50 p-4 text-sm">
              <div>
                <span className="text-gray-500">Turno:</span> <span className="font-semibold">#{turnoFinalizar.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Guarda:</span>{" "}
                <span className="font-semibold">{nombreUsuario(usuariosMap.get(turnoFinalizar.guarda) ?? null)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sede:</span>{" "}
                <span className="font-semibold">{sedesByCode.get(turnoFinalizar.sede) || turnoFinalizar.sede}</span>
              </div>
              <div>
                <span className="text-gray-500">Jornada:</span>{" "}
                <span className="font-semibold">{normalizarJornada(turnoFinalizar.jornada)}</span>
              </div>
              <div>
                <span className="text-gray-500">Inicio:</span>{" "}
                <span className="font-semibold">{formatFecha(turnoFinalizar.inicio)}</span>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              Esto finalizara el turno inmediatamente. Usalo solo si el guarda olvido cerrar el turno.
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => {
                  if (finalizando) return;
                  setOpenFinalizar(false);
                  setTurnoFinalizar(null);
                }}
                variant="secondary"
                disabled={finalizando}
              >
                Cancelar
              </Button>

              <Button onClick={confirmarFinalizar} variant="primary" disabled={finalizando}>
                {finalizando ? "Finalizando..." : "Si, finalizar"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
