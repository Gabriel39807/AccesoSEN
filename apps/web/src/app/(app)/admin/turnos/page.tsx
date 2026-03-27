"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconClock } from "@/components/aprendiz/dashboard/DashboardIcons";
import BadgeChip from "@/components/admin/BadgeChip";
import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import Button from "@/components/dashboard/shared/Button";
import AdminTableSkeleton from "@/components/dashboard/shared/AdminTableSkeleton";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import FormBanner from "@/components/feedback/FormBanner";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { useSedes } from "@/hooks/useSedes";
import { api } from "@/lib/api";
import { parseApiError } from "@/lib/apiError";

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
  jornada: "MANANA" | "MA\u00d1ANA" | "TARDE" | "NOCHE";
  inicio: string;
  fin: string | null;
  activo: boolean;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const JORNADAS: Turno["jornada"][] = ["MANANA", "MA\u00d1ANA", "TARDE", "NOCHE"];

function nombreUsuario(usuario?: Usuario | null) {
  if (!usuario) return "-";
  const full = `${usuario.first_name ?? ""} ${usuario.last_name ?? ""}`.trim();
  return full || usuario.username;
}

function formatFecha(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizarJornada(jornada: Turno["jornada"]) {
  if (jornada === "MANANA" || jornada === "MA\u00d1ANA") return "Ma\u00f1ana";
  if (jornada === "TARDE") return "Tarde";
  return "Noche";
}

function safeErrorMessage(e: any) {
  const parsed = parseApiError(e);
  return parsed.message || "No se pudo completar la operacion.";
}

function StatSkeleton() {
  return <div className="command-noir-metric h-[92px] animate-pulse" />;
}

function FilterSkeleton() {
  return (
    <section className="sadi-card rounded-[1.3rem] p-3 sm:p-3.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-2" />
      </div>
    </section>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <AdminTableSkeleton
      rows={rows}
      columns={[
        { label: "ID", widthClass: "w-20", variant: "text" },
        { label: "Guarda", widthClass: "w-52", variant: "stack" },
        { label: "Sede", widthClass: "w-32", variant: "text" },
        { label: "Jornada", widthClass: "w-28", variant: "pill" },
        { label: "Inicio", widthClass: "w-40", variant: "text" },
        { label: "Fin", widthClass: "w-40", variant: "text" },
        { label: "Estado", widthClass: "w-28", variant: "pill" },
        { label: "Acciones", widthClass: "w-32", align: "right", variant: "button" },
      ]}
    />
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div data-tone={tone} className="command-noir-metric text-left">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-[1.55rem] font-semibold leading-none tracking-[-0.05em] text-[color:var(--color-text)]">
            {value.toLocaleString("es-CO")}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-[color:var(--color-text-muted)]">{detail}</p>
        </div>
        <span
          className={[
            "mt-0.5 h-2 w-2 shrink-0 rounded-full opacity-90",
            tone === "success" ? "bg-[color:var(--success)]" : "bg-[color:var(--primary)]",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function jornadaTone(jornada: Turno["jornada"]) {
  if (jornada === "TARDE") return "warning" as const;
  if (jornada === "NOCHE") return "neutral" as const;
  return "info" as const;
}

export default function AdminTurnosPage() {
  const { sedes } = useSedes();
  const sedesByCode = useMemo(() => new Map(sedes.map((item) => [item.code, item.name])), [sedes]);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [count, setCount] = useState(0);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
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
  const [pageSize, setPageSize] = useState(10);
  const firstFilterFetchRef = useRef(true);
  const firstPageFetchRef = useRef(true);

  const usuariosMap = useMemo(() => {
    const map = new Map<number, Usuario>();
    usuarios.forEach((usuario) => map.set(usuario.id, usuario));
    return map;
  }, [usuarios]);

  const guardas = useMemo(() => usuarios.filter((usuario) => usuario.rol === "guarda"), [usuarios]);

  const stats = useMemo(() => {
    const total = count;
    const activosCount = turnos.filter((turno) => turno.activo && !turno.fin).length;
    const finalizados = turnos.filter((turno) => !turno.activo || !!turno.fin).length;
    return { total, activos: activosCount, finalizados };
  }, [count, turnos]);

  const hasFilters = sede !== "" || jornada !== "" || activo !== "" || guardaId !== "";
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  async function cargarUsuarios() {
    const res = await api.get<Paginated<Usuario> | Usuario[]>("/api/usuarios/", {
      params: { page_size: 100, rol: "guarda" },
    });
    const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    setUsuarios(data);
  }

  async function cargarTurnos(targetPage = page) {
    setLoadingTable(true);

    const params: Record<string, string | number> = { page: targetPage, page_size: pageSize };
    if (sede) params.sede = sede;
    if (jornada) params.jornada = jornada;
    if (activo) params.activo = activo;
    if (guardaId !== "") params.guarda = guardaId;

    try {
      const res = await api.get<Paginated<Turno> | Turno[]>("/api/turnos/", { params });
      const payload = res.data;
      const data = Array.isArray(payload) ? payload : payload?.results ?? [];
      const total = Array.isArray(payload) ? data.length : payload?.count ?? data.length;
      setTurnos(data);
      setCount(total);
    } finally {
      setLoadingTable(false);
    }
  }

  async function cargarBase() {
    setLoading(true);
    setLoadingTable(true);
    setError(null);

    try {
      await Promise.all([cargarUsuarios(), cargarTurnos(1)]);
      setPage(1);
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setLoading(false);
      setLoadingTable(false);
    }
  }

  async function refrescar() {
    setReloading(true);
    setError(null);

    try {
      await cargarTurnos(page);
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

  function abrirFinalizar(turno: Turno) {
    setTurnoFinalizar(turno);
    setOpenFinalizar(true);
  }

  async function confirmarFinalizar() {
    if (!turnoFinalizar) return;

    setFinalizando(true);
    setError(null);

    try {
      const res = await api.post(`/api/turnos/${turnoFinalizar.id}/finalizar_admin/`);
      if (res?.data?.permitido === false) {
        setError(String(res?.data?.motivo || "No se pudo finalizar el turno. Verifica permisos o estado e intenta de nuevo."));
        return;
      }

      setOpenFinalizar(false);
      setTurnoFinalizar(null);
      await cargarTurnos(page);
    } catch (e: any) {
      setError(safeErrorMessage(e) || "No se pudo finalizar el turno. Revisa tu conexion e intenta nuevamente.");
      await cargarTurnos(page);
    } finally {
      setFinalizando(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstFilterFetchRef.current) {
      firstFilterFetchRef.current = false;
      return;
    }

    setPage(1);
    cargarTurnos(1).catch((e) => setError(safeErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, jornada, activo, guardaId, pageSize]);

  useEffect(() => {
    if (firstPageFetchRef.current) {
      firstPageFetchRef.current = false;
      return;
    }

    cargarTurnos(page).catch((e) => setError(safeErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="space-y-4 pb-2">
      <PageHeader
        breadcrumb="ADMIN / TURNOS"
        title="Turnos"
        description="Control de turnos de guardas y finalizacion manual por administracion."
        actions={
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[1.05rem] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-subtle)_98%,white),color-mix(in_srgb,var(--surface-muted)_92%,transparent))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            <Button onClick={refrescar} variant="secondary" disabled={reloading} className="px-3 py-1.5 text-[13px]">
              {reloading ? "Recargando..." : "Recargar"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Total" value={stats.total} detail="Turnos visibles con los filtros actuales." />
            <MetricCard label="Activos" value={stats.activos} detail="Guardas con turno en curso." tone="success" />
            <MetricCard label="Finalizados" value={stats.finalizados} detail="Turnos cerrados o sin actividad." />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar footer={error ? <FormBanner type="error" message={error} /> : null}>
          <label className="md:col-span-6 lg:col-span-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Sede</div>
            <select className="command-noir-control h-10 w-full text-sm" value={sede} onChange={(event) => setSede(event.target.value)}>
              <option value="">Todas</option>
              {sedes.map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Jornada</div>
            <select
              className="command-noir-control h-10 w-full text-sm"
              value={jornada}
              onChange={(event) => setJornada(event.target.value as "" | Turno["jornada"])}
            >
              <option value="">Todas</option>
              {JORNADAS.map((item) => (
                <option key={item} value={item}>
                  {normalizarJornada(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Estado</div>
            <select className="command-noir-control h-10 w-full text-sm" value={activo} onChange={(event) => setActivo(event.target.value as "" | "true" | "false")}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Finalizados</option>
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Guarda</div>
            <select
              className="command-noir-control h-10 w-full text-sm"
              value={guardaId}
              onChange={(event) => setGuardaId(event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">Todos</option>
              {guardas.map((guarda) => (
                <option key={guarda.id} value={guarda.id}>
                  {nombreUsuario(guarda)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end justify-end gap-2 md:col-span-6 lg:col-span-2">
            <Button
              onClick={() => {
                setPage(1);
                cargarTurnos(1).catch(() => setError("No se pudieron cargar los turnos."));
              }}
              variant="primary"
              className="h-10 px-3 text-[13px]"
            >
              Aplicar
            </Button>
            <Button
              onClick={() => {
                resetFiltros();
                setTimeout(() => cargarTurnos(1).catch(() => undefined), 0);
              }}
              variant="secondary"
              disabled={!hasFilters}
              className="h-10 px-3 text-[13px]"
            >
              Limpiar
            </Button>
          </div>

          <div className="flex h-10 items-end justify-end md:col-span-12 lg:col-span-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-soft)]">{count} turnos</span>
            </div>
          </div>
        </FilterBar>
      )}

      <div className="space-y-3">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={turnos.length > 0}
          tableClassName="min-w-[980px]"
          headers={
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Guarda</th>
              <th className="px-4 py-3">Sede</th>
              <th className="px-4 py-3">Jornada</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
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
          {turnos.map((turno) => {
            const usuario = usuariosMap.get(turno.guarda) ?? null;
            const isActivo = turno.activo && !turno.fin;

            return (
              <tr key={turno.id} className="command-noir-table-row">
                <td className="px-4 py-3.5">
                  <div className="text-[0.9rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text)]">#{turno.id}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-[color:var(--color-text)]">{nombreUsuario(usuario)}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-[color:var(--color-text-muted)]">{usuario?.username ?? "-"}</div>
                </td>
                <td className="px-4 py-3.5 text-[color:var(--color-text)]">{sedesByCode.get(turno.sede) || turno.sede}</td>
                <td className="px-4 py-3.5">
                  <BadgeChip tone={jornadaTone(turno.jornada)}>{normalizarJornada(turno.jornada)}</BadgeChip>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-[color:var(--color-text)]">{formatFecha(turno.inicio)}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-[color:var(--color-text-soft)]">{formatFecha(turno.fin)}</div>
                </td>
                <td className="px-4 py-3.5">
                  <BadgeChip tone={isActivo ? "success" : "neutral"}>{isActivo ? "Activo" : "Finalizado"}</BadgeChip>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    onClick={() => abrirFinalizar(turno)}
                    disabled={!isActivo}
                    variant="secondary"
                    className="rounded-xl px-2.5 py-1.5 text-[11px] disabled:border-[color:var(--surface-border)] disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--color-text-faint)]"
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
          totalCount={count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
        />
      </div>

      <Modal
        open={openFinalizar}
        title="Finalizar turno"
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
                <span className="text-gray-500">Inicio:</span> <span className="font-semibold">{formatFecha(turnoFinalizar.inicio)}</span>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              Esto finalizara el turno inmediatamente. Usalo solo si el guarda olvido cerrarlo.
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
