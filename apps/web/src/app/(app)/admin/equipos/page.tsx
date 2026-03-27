"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import BadgeChip from "@/components/admin/BadgeChip";
import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import AdminTableSkeleton from "@/components/dashboard/shared/AdminTableSkeleton";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import Button from "@/components/dashboard/shared/Button";
import FormBanner from "@/components/feedback/FormBanner";
import FieldError from "@/components/feedback/FieldError";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { parseApiError } from "@/lib/apiError";

type Usuario = {
  id: number;
  username: string;
  rol: "admin" | "guarda" | "aprendiz" | string;
  first_name?: string;
  last_name?: string;
  documento?: string | null;
};

type Equipo = {
  id: number;
  propietario: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado" | string;
  motivo_rechazo?: string | null;
  revisado_por?: number | null;
  revisado_en?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function useDebounced<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function safeErrorMessage(e: any) {
  const parsed = parseApiError(e);
  if (parsed.message) return parsed.message;
  return (
    e?.response?.data?.detail ??
    e?.response?.data?.motivo ??
    (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ??
    e?.message ??
    "Ocurrió un error."
  );
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "—";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function formatEquipoEstado(estado: Equipo["estado"]) {
  const normalized = String(estado).toLowerCase();
  if (normalized === "aprobado") return { label: "Aprobado", tone: "success" as const };
  if (normalized === "rechazado") return { label: "Rechazado", tone: "danger" as const };
  return { label: "Pendiente", tone: "warning" as const };
}

function StatSkeleton() {
  return <div className="rounded-2xl border bg-white shadow-sm p-4 animate-pulse h-[92px]" />;
}
function FilterSkeleton() {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-7" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
      </div>
    </section>
  );
}

function MetricPanel({
  label,
  value,
  detail,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{label}</p>
          <p className="mt-1.5 text-[1.45rem] font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">{value.toLocaleString("es-CO")}</p>
        </div>
        <span className="command-noir-chip" data-tone={tone}>{detail}</span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--color-text-soft)]">
        {label === "Total"
          ? "Inventario visible en la consulta actual."
          : label === "Pendientes"
            ? "Equipos que requieren decisión administrativa."
            : label === "Aprobados"
              ? "Registros habilitados para circular sin observaciones."
              : "Casos con rechazo documentado para seguimiento."}
      </p>
    </>
  );

  if (!onClick) return <article className="command-noir-metric">{content}</article>;

  return (
    <button
      type="button"
      onClick={onClick}
      className="command-noir-metric text-left transition hover:-translate-y-0.5 hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.05)]"
    >
      {content}
    </button>
  );
}
function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <AdminTableSkeleton
      rows={rows}
      columns={[
        { label: "Serial", widthClass: "w-36", variant: "text" },
        { label: "Marca / Modelo", widthClass: "w-44", variant: "stack" },
        { label: "Propietario", widthClass: "w-48", variant: "stack" },
        { label: "Estado", widthClass: "w-28", variant: "pill" },
        { label: "Motivo", widthClass: "w-36", variant: "text" },
        { label: "Acciones", widthClass: "w-32", align: "right", variant: "button" },
      ]}
    />
  );
}

export default function AdminEquiposPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"" | "pendiente" | "aprobado" | "rechazado">("");

  const dq = useDebounced(q, 450);
  const requestIdRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modal revisar
  const [openRevisar, setOpenRevisar] = useState(false);
  const [equipoSel, setEquipoSel] = useState<Equipo | null>(null);
  const [accion, setAccion] = useState<"aprobado" | "rechazado">("aprobado");
  const [motivo, setMotivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [reviewBanner, setReviewBanner] = useState<string | null>(null);
  const [reviewFieldError, setReviewFieldError] = useState<string>("");

  const usuariosMap = useMemo(() => {
    const m = new Map<number, Usuario>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const stats = useMemo(() => {
    const total = count;
    const pendientes = equipos.filter((e) => String(e.estado).toLowerCase() === "pendiente").length;
    const aprobados = equipos.filter((e) => String(e.estado).toLowerCase() === "aprobado").length;
    const rechazados = equipos.filter((e) => String(e.estado).toLowerCase() === "rechazado").length;
    return { total, pendientes, aprobados, rechazados };
  }, [equipos, count]);
  const pendingItems = useMemo(
    () => equipos.filter((item) => String(item.estado).toLowerCase() === "pendiente"),
    [equipos],
  );

  async function cargarUsuarios() {
    const res = await api.get<Usuario[] | Paginated<Usuario>>("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    setUsuarios(data);
  }

  async function cargarEquipos(p = page) {
    const rid = ++requestIdRef.current;
    setLoadingTable(true);
    setError(null);

    try {
      const params: any = { page: p, page_size: pageSize };
      if (dq.trim()) params.q = dq.trim();
      if (estado) params.estado = estado;

      const r = await api.get<Paginated<Equipo> | Equipo[]>("/api/equipos/", { params });

      const payload: any = r.data;
      const results = Array.isArray(payload) ? payload : payload.results ?? [];
      const c = Array.isArray(payload) ? results.length : payload.count ?? results.length;

      if (rid !== requestIdRef.current) return;

      setEquipos(results);
      setCount(c);
    } catch (e: any) {
      if (rid !== requestIdRef.current) return;
      setError(safeErrorMessage(e));
    } finally {
      if (rid === requestIdRef.current) setLoadingTable(false);
    }
  }

  async function cargarBase() {
    setLoading(true);
    setLoadingTable(true);
    setError(null);
    try {
      await cargarUsuarios();
      await cargarEquipos(1);
      setPage(1);
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setLoading(false);
      setLoadingTable(false);
    }
  }

  function resetFiltros() {
    setQ("");
    setEstado("");
    setPage(1);
  }

  function aplicarEstado(nextEstado: "" | "pendiente" | "aprobado" | "rechazado") {
    setEstado(nextEstado);
    setPage(1);
  }

  function abrirRevisar(e: Equipo) {
    setEquipoSel(e);
    setAccion("aprobado");
    setMotivo("");
    setReviewBanner(null);
    setReviewFieldError("");
    setOpenRevisar(true);
  }

  async function confirmarRevision() {
    if (!equipoSel) return;

    if (accion === "rechazado" && !motivo.trim()) {
      setReviewFieldError("Debes escribir el motivo de rechazo.");
      setReviewBanner("Para rechazar un equipo debes registrar el motivo.");
      return;
    }

    setReviewBanner(null);
    setReviewFieldError("");
    setRevisando(true);
    try {
      await api.patch(`/api/equipos/${equipoSel.id}/revisar/`, {
        estado: accion,
        motivo_rechazo: accion === "rechazado" ? motivo.trim() : null,
      });

      setOpenRevisar(false);
      setEquipoSel(null);
      await cargarEquipos(page);
    } catch (e: any) {
      setReviewBanner(safeErrorMessage(e));
      await cargarEquipos(page);
    } finally {
      setRevisando(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtros -> page 1
  useEffect(() => {
    setPage(1);
    cargarEquipos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, estado, pageSize]);

  // page -> refetch
  useEffect(() => {
    cargarEquipos(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const hasFilters = q.trim().length > 0 || estado !== "";
  const activeFilterCount = (q.trim() ? 1 : 0) + (estado !== "" ? 1 : 0);
  const pendingPreview = pendingItems.slice(0, 3).map((item) => item.serial).join(", ");

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        breadcrumb="ADMIN > EQUIPOS"
        title="Equipos"
        description="Revisión y control de equipos registrados por los aprendices."
        actions={
          <>
            <Button onClick={() => cargarEquipos(page)} variant="secondary">
              Recargar
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <MetricPanel label="Total" value={stats.total} detail={`${count} registros`} onClick={() => aplicarEstado("")} />
            <MetricPanel label="Pendientes" value={stats.pendientes} detail="por revisar" tone="warning" onClick={() => aplicarEstado("pendiente")} />
            <MetricPanel label="Aprobados" value={stats.aprobados} detail="listos" tone="success" onClick={() => aplicarEstado("aprobado")} />
            <MetricPanel label="Rechazados" value={stats.rechazados} detail="observados" tone="danger" onClick={() => aplicarEstado("rechazado")} />
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
          <div className="md:col-span-12">
            <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Bandeja de revisión</p>
                <p className="mt-1 text-sm text-[color:var(--color-text)]">
                  {equipos.length
                    ? `${equipos.length} equipos visibles en esta página. ${pendingItems.length ? `Pendientes destacados: ${pendingPreview}${pendingItems.length > 3 ? "..." : ""}.` : "No hay pendientes inmediatos en la vista actual."}`
                    : "Usa la búsqueda para ubicar seriales, propietarios o estados con rapidez."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="command-noir-chip whitespace-nowrap" data-tone={hasFilters ? "info" : "neutral"}>
                  {activeFilterCount} filtro(s)
                </span>
                <span className="command-noir-chip whitespace-nowrap" data-tone={pendingItems.length ? "warning" : "neutral"}>
                  {pendingItems.length} pendientes en página
                </span>
                <span className="command-noir-chip whitespace-nowrap" data-tone="neutral">
                  {count} equipos
                </span>
              </div>
            </div>
          </div>

          <input
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-7"
            placeholder="Serial, marca, modelo, documento o username"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-3"
            value={estado}
            onChange={(e) => setEstado(e.target.value as any)}
          >
            <option value="">Estado (todos)</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>

          <Button
            onClick={resetFiltros}
            className="h-11 md:col-span-2"
            variant="secondary"
            disabled={!hasFilters}
          >
            Limpiar
          </Button>
        </FilterBar>
      )}

      <div className="space-y-4">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={equipos.length > 0}
          tableClassName="min-w-[920px]"
          headers={
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Serial</th>
              <th className="px-4 py-3 font-semibold">Marca / Modelo</th>
              <th className="px-4 py-3 font-semibold">Propietario</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Motivo</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          }
          emptyState={
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <EmptyState
                    title="Sin equipos en esta vista"
                    description={hasFilters ? "Ajusta o limpia los filtros para recuperar resultados." : "Todavía no hay equipos cargados para revisión."}
                    action={
                      hasFilters ? (
                        <Button onClick={resetFiltros} variant="secondary">
                          Limpiar filtros
                        </Button>
                      ) : null
                    }
                  />
                </div>
              </td>
            </tr>
          }
        >
          {equipos.map((e) => {
            const owner = usuariosMap.get(e.propietario);
            const status = formatEquipoEstado(e.estado);

            return (
              <tr key={e.id} className="border-b transition hover:bg-sky-50/35">
                <td className="px-4 py-3 text-gray-900">
                  <div className="font-semibold">{e.serial}</div>
                  <div className="mt-1 text-xs text-gray-500">Equipo #{e.id}</div>
                </td>
                <td className="px-4 py-3 text-gray-800">
                  <div className="font-medium">{e.marca}</div>
                  <div className="text-xs text-gray-500">{e.modelo}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{nombreUsuario(owner)}</div>
                  <div className="text-xs text-gray-500">
                    {owner?.documento ?? "Sin documento"}
                    {owner?.username ? ` · @${owner.username}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <BadgeChip tone={status.tone}>{status.label}</BadgeChip>
                    <span className="text-xs text-gray-500">
                      {status.label === "Pendiente"
                        ? "Esperando revisión administrativa"
                        : status.label === "Aprobado"
                          ? "Validado para circulación"
                          : "Requiere corrección antes de aprobar"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="max-w-[18rem] text-sm leading-6 text-gray-700">
                    {status.label === "Rechazado" ? e.motivo_rechazo || "Sin motivo registrado" : "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Button onClick={() => abrirRevisar(e)} variant="secondary" className="px-3 py-1.5 text-xs">
                      Revisar
                    </Button>
                    <span className="text-[11px] text-gray-500">
                      {status.label === "Pendiente" ? "Sin decisión" : `Estado actual: ${status.label.toLowerCase()}`}
                    </span>
                  </div>
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
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>

        {/* Modal revisar */}
        <Modal
          open={openRevisar}
          title={equipoSel ? `Revisar equipo: ${equipoSel.serial}` : "Revisar equipo"}
          onClose={() => {
            if (revisando) return;
            setOpenRevisar(false);
            setEquipoSel(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Serial</div>
                <div className="mt-1 font-semibold text-gray-900">{equipoSel?.serial ?? "—"}</div>
              </div>
              <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Equipo</div>
                <div className="mt-1 font-semibold text-gray-900">{equipoSel ? `${equipoSel.marca} ${equipoSel.modelo}` : "—"}</div>
              </div>
              <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Contexto</div>
                <div className="mt-1 text-gray-700">Aprobar habilita el registro; rechazar exige motivo visible para auditoría.</div>
              </div>
            </div>
            {reviewBanner ? <FormBanner type="error" message={reviewBanner} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Acción</label>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                  value={accion}
                  onChange={(e) => setAccion(e.target.value as any)}
                >
                  <option value="aprobado">Aprobar</option>
                  <option value="rechazado">Rechazar</option>
                </select>
                <div className="pt-2">
                  {accion === "aprobado" ? (
                    <BadgeChip tone="success">Aprobado</BadgeChip>
                  ) : (
                    <BadgeChip tone="danger">Rechazado</BadgeChip>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500">Motivo (solo si rechazas)</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                  placeholder="Ej: Equipo sin etiqueta o serial no coincide..."
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    if (reviewFieldError) setReviewFieldError("");
                    if (reviewBanner) setReviewBanner(null);
                  }}
                  disabled={accion !== "rechazado"}
                />
                <FieldError text={reviewFieldError} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenRevisar(false)}
                disabled={revisando}
                className="rounded-xl px-4 py-2 border bg-white hover:bg-gray-50 transition disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                onClick={confirmarRevision}
                disabled={revisando}
                className="rounded-xl px-4 py-2 bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition disabled:opacity-60"
              >
                {revisando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
