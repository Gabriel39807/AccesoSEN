"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BadgeChip from "@/components/admin/BadgeChip";
import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import Button from "@/components/dashboard/shared/Button";
import AdminTableSkeleton from "@/components/dashboard/shared/AdminTableSkeleton";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import FieldError from "@/components/feedback/FieldError";
import FormBanner from "@/components/feedback/FormBanner";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { api } from "@/lib/api";
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
    "Ocurrio un error."
  );
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "-";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function StatSkeleton() {
  return <div className="command-noir-metric h-[92px] animate-pulse" />;
}

function FilterSkeleton() {
  return (
    <section className="sadi-card rounded-[1.3rem] p-3 sm:p-3.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-7" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-3" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-1" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-1" />
      </div>
    </section>
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

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
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
            tone === "danger"
              ? "bg-[color:var(--danger)]"
              : tone === "warning"
                ? "bg-[color:var(--warning)]"
                : tone === "success"
                  ? "bg-[color:var(--success)]"
                  : "bg-[color:var(--primary)]",
          ].join(" ")}
        />
      </div>
    </div>
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

  const [openRevisar, setOpenRevisar] = useState(false);
  const [equipoSel, setEquipoSel] = useState<Equipo | null>(null);
  const [accion, setAccion] = useState<"aprobado" | "rechazado">("aprobado");
  const [motivo, setMotivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [reviewBanner, setReviewBanner] = useState<string | null>(null);
  const [reviewFieldError, setReviewFieldError] = useState("");

  const usuariosMap = useMemo(() => {
    const map = new Map<number, Usuario>();
    usuarios.forEach((u) => map.set(u.id, u));
    return map;
  }, [usuarios]);

  const stats = useMemo(() => {
    const total = count;
    const pendientes = equipos.filter((equipo) => String(equipo.estado).toLowerCase() === "pendiente").length;
    const aprobados = equipos.filter((equipo) => String(equipo.estado).toLowerCase() === "aprobado").length;
    const rechazados = equipos.filter((equipo) => String(equipo.estado).toLowerCase() === "rechazado").length;

    return { total, pendientes, aprobados, rechazados };
  }, [equipos, count]);

  async function cargarUsuarios() {
    const res = await api.get<Usuario[] | Paginated<Usuario>>("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : (res.data as Paginated<Usuario>)?.results ?? [];
    setUsuarios(data);
  }

  async function cargarEquipos(p = page) {
    const rid = ++requestIdRef.current;
    setLoadingTable(true);
    setError(null);

    try {
      const params: Record<string, string | number> = { page: p, page_size: pageSize };
      if (dq.trim()) params.q = dq.trim();
      if (estado) params.estado = estado;

      const response = await api.get<Paginated<Equipo> | Equipo[]>("/api/equipos/", { params });
      const payload = response.data;
      const results = Array.isArray(payload) ? payload : payload.results ?? [];
      const total = Array.isArray(payload) ? results.length : payload.count ?? results.length;

      if (rid !== requestIdRef.current) return;

      setEquipos(results);
      setCount(total);
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

  function abrirRevisar(equipo: Equipo) {
    setEquipoSel(equipo);
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

  useEffect(() => {
    setPage(1);
    cargarEquipos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, estado, pageSize]);

  useEffect(() => {
    cargarEquipos(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const hasFilters = q.trim().length > 0 || estado !== "";

  return (
    <div className="space-y-4 pb-2">
      <PageHeader
        breadcrumb="ADMIN / EQUIPOS"
        title="Equipos"
        description="Revision y control institucional de equipos registrados por los aprendices."
        actions={
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[1.05rem] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-subtle)_98%,white),color-mix(in_srgb,var(--surface-muted)_92%,transparent))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            <Button onClick={() => cargarEquipos(page)} variant="secondary" className="px-3 py-1.5 text-[13px]">
              Recargar
            </Button>
          </div>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Total" value={stats.total} detail="Equipos visibles con los filtros actuales." />
            <MetricCard label="Pendientes" value={stats.pendientes} detail="A la espera de revision administrativa." tone="warning" />
            <MetricCard label="Aprobados" value={stats.aprobados} detail="Validados para operacion institucional." tone="success" />
            <MetricCard label="Rechazados" value={stats.rechazados} detail="Con observacion o rechazo registrado." tone="danger" />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar footer={error ? <FormBanner type="error" message={error} /> : null}>
          <label className="md:col-span-7">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Buscar</div>
            <input
              className="command-noir-control h-10 w-full text-sm"
              placeholder="Buscar por serial, marca, modelo, documento o username"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>

          <label className="md:col-span-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Estado</div>
            <select
              className="command-noir-control h-10 w-full text-sm"
              value={estado}
              onChange={(event) => setEstado(event.target.value as "" | "pendiente" | "aprobado" | "rechazado")}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </label>

          <Button onClick={resetFiltros} className="h-10 md:col-span-1 md:mt-[19px]" variant="secondary" disabled={!hasFilters}>
            Limpiar
          </Button>

          <div className="flex h-10 items-end justify-end md:col-span-1 md:mt-[19px]">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-soft)]">{count} equipos</span>
            </div>
          </div>
        </FilterBar>
      )}

      <div className="space-y-3">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={equipos.length > 0}
          tableClassName="min-w-[980px]"
          headers={
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Marca / Modelo</th>
              <th className="px-4 py-3">Propietario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3 text-right">Gestion</th>
            </tr>
          }
          emptyState={
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <EmptyState title="Sin registros con estos filtros" description="Ajusta los filtros para continuar." />
                </div>
              </td>
            </tr>
          }
        >
          {equipos.map((equipo) => {
            const owner = usuariosMap.get(equipo.propietario);
            const st = String(equipo.estado).toLowerCase();

            return (
              <tr key={equipo.id} className="command-noir-table-row">
                <td className="px-4 py-3.5">
                  <div className="text-[0.95rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text)]">{equipo.serial}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-[color:var(--color-text)]">{equipo.marca}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-[color:var(--color-text-muted)]">{equipo.modelo}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-[color:var(--color-text)]">{nombreUsuario(owner)}</div>
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-[color:var(--color-text-muted)]">{owner?.documento ?? "-"}</div>
                </td>
                <td className="px-4 py-3.5">
                  <BadgeChip tone={st === "aprobado" ? "success" : st === "rechazado" ? "danger" : "warning"}>
                    {st === "aprobado" ? "Aprobado" : st === "rechazado" ? "Rechazado" : "Pendiente"}
                  </BadgeChip>
                </td>
                <td className="px-4 py-3.5 text-[0.9rem] text-[color:var(--color-text-soft)]">
                  {st === "rechazado" ? equipo.motivo_rechazo || "-" : "-"}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button onClick={() => abrirRevisar(equipo)} variant="secondary" className="rounded-xl px-2.5 py-1.5 text-[11px]">
                    Revisar
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
        open={openRevisar}
        title={equipoSel ? `Revisar equipo: ${equipoSel.serial}` : "Revisar equipo"}
        onClose={() => {
          if (revisando) return;
          setOpenRevisar(false);
          setEquipoSel(null);
        }}
      >
        <div className="space-y-4">
          <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
            Selecciona aprobar o rechazar. Si rechazas, debes poner un motivo.
          </div>
          {reviewBanner ? <FormBanner type="error" message={reviewBanner} /> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Accion</label>
              <select
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                value={accion}
                onChange={(event) => setAccion(event.target.value as "aprobado" | "rechazado")}
              >
                <option value="aprobado">Aprobar</option>
                <option value="rechazado">Rechazar</option>
              </select>
              <div className="pt-2">
                {accion === "aprobado" ? <BadgeChip tone="success">Aprobado</BadgeChip> : <BadgeChip tone="danger">Rechazado</BadgeChip>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Motivo (solo si rechazas)</label>
              <input
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="Ej: Equipo sin etiqueta o serial no coincide..."
                value={motivo}
                onChange={(event) => {
                  setMotivo(event.target.value);
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
              className="rounded-xl border bg-white px-4 py-2 transition hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              onClick={confirmarRevision}
              disabled={revisando}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {revisando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
