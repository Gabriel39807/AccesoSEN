"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconHistory } from "@/components/aprendiz/dashboard/DashboardIcons";
import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import Button from "@/components/dashboard/shared/Button";
import AdminTableSkeleton from "@/components/dashboard/shared/AdminTableSkeleton";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { useSedes } from "@/hooks/useSedes";
import { api } from "@/lib/api";

type Usuario = {
  id: number;
  username: string;
  email?: string;
  rol: "admin" | "guarda" | "aprendiz" | string;
  first_name?: string;
  last_name?: string;
  documento?: string | null;
  estado?: "activo" | "bloqueado" | string;
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

type Equipo = {
  id: number;
  propietario: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado" | string;
};

type Acceso = {
  id: number;
  usuario: number;
  fecha: string;
  tipo: "ingreso" | "salida";
  sede: string | null;
  registrado_por: number | null;
  turno: number | null;
  equipos: number[];
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function clsBadge(variant: "green" | "red" | "teal" | "amber" | "gray") {
  if (variant === "green") return "success";
  if (variant === "red") return "danger";
  if (variant === "teal") return "info";
  if (variant === "amber") return "warning";
  return "neutral";
}

function Badge({
  variant,
  label,
}: {
  variant: "green" | "red" | "teal" | "amber" | "gray";
  label: string;
}) {
  return (
    <span className="command-noir-chip" data-tone={clsBadge(variant)}>
      {label}
    </span>
  );
}

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

function safeErrorMessage(e: any) {
  return (
    e?.response?.data?.motivo ??
    e?.response?.data?.detail ??
    (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ??
    e?.message ??
    "Ocurrio un error."
  );
}

function useDebounced<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function StatSkeleton() {
  return <div className="command-noir-metric h-[92px] animate-pulse" />;
}

function FilterSkeleton() {
  return (
    <section className="sadi-card rounded-[1.3rem] p-3 sm:p-3.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-12 lg:col-span-4" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-6 lg:col-span-1" />
        <div className="sadi-skeleton h-10 rounded-xl md:col-span-12 lg:col-span-2" />
      </div>
    </section>
  );
}

function MetricPanel({
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
    <article data-tone={tone} className="command-noir-metric text-left">
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
    </article>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <AdminTableSkeleton
      rows={rows}
      columns={[
        { label: "Fecha", widthClass: "w-44", variant: "stack" },
        { label: "Tipo", widthClass: "w-28", variant: "pill" },
        { label: "Sede", widthClass: "w-28", variant: "text" },
        { label: "Aprendiz", widthClass: "w-56", variant: "stack" },
        { label: "Registrado por", widthClass: "w-52", variant: "stack" },
        { label: "Equipos", widthClass: "w-36", variant: "stack" },
        { label: "Acciones", widthClass: "w-32", align: "right", variant: "button" },
      ]}
    />
  );
}

export default function AdminAccesosPage() {
  const { sedes } = useSedes();
  const sedesByCode = useMemo(() => new Map(sedes.map((item) => [item.code, item.name])), [sedes]);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"" | Acceso["tipo"]>("");
  const [sede, setSede] = useState<string>("");
  const [aprendizId, setAprendizId] = useState<number | "">("");
  const [guardaId, setGuardaId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const dq = useDebounced(q, 450);
  const dDateFrom = useDebounced(dateFrom, 450);
  const dDateTo = useDebounced(dateTo, 450);

  const [openDetalle, setOpenDetalle] = useState(false);
  const [selected, setSelected] = useState<Acceso | null>(null);
  const [detalleTurno, setDetalleTurno] = useState<Turno | null>(null);
  const [detalleEquipos, setDetalleEquipos] = useState<Equipo[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const requestIdRef = useRef(0);

  const usuariosMap = useMemo(() => {
    const map = new Map<number, Usuario>();
    usuarios.forEach((usuario) => map.set(usuario.id, usuario));
    return map;
  }, [usuarios]);

  const aprendicesAll = useMemo(() => usuarios.filter((usuario) => usuario.rol === "aprendiz"), [usuarios]);
  const guardasAll = useMemo(() => usuarios.filter((usuario) => usuario.rol === "guarda"), [usuarios]);

  const stats = useMemo(() => {
    const total = count;
    const ingresos = accesos.filter((acceso) => acceso.tipo === "ingreso").length;
    const salidas = accesos.filter((acceso) => acceso.tipo === "salida").length;
    const conEquipos = accesos.filter((acceso) => (acceso.equipos ?? []).length > 0).length;
    return { total, ingresos, salidas, conEquipos };
  }, [accesos, count]);

  const hasFilters =
    q.trim().length > 0 ||
    tipo !== "" ||
    sede !== "" ||
    aprendizId !== "" ||
    guardaId !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  async function cargarUsuarios() {
    const res = await api.get<Usuario[] | Paginated<Usuario>>("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    setUsuarios(data);
  }

  async function cargarAccesos(p = page) {
    const rid = ++requestIdRef.current;
    setLoadingTable(true);
    setError(null);

    try {
      const params: Record<string, string | number> = { page: p, page_size: pageSize };
      if (dq.trim()) params.q = dq.trim();
      if (tipo) params.tipo = tipo;
      if (sede) params.sede = sede;
      if (aprendizId !== "") params.usuario = aprendizId;
      if (guardaId !== "") params.registrado_por = guardaId;
      if (dDateFrom) params.date_from = dDateFrom;
      if (dDateTo) params.date_to = dDateTo;

      const response = await api.get<Paginated<Acceso> | Acceso[]>("/api/accesos/", { params });
      const payload: any = response.data;
      const results = Array.isArray(payload) ? payload : payload.results ?? [];
      const total = Array.isArray(payload) ? results.length : payload.count ?? results.length;

      if (rid !== requestIdRef.current) return;
      setAccesos(results);
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
      await cargarAccesos(1);
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
    setTipo("");
    setSede("");
    setAprendizId("");
    setGuardaId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  async function abrirDetalle(acceso: Acceso) {
    setSelected(acceso);
    setOpenDetalle(true);
    setDetalleTurno(null);
    setDetalleEquipos([]);
    setLoadingDetalle(true);

    try {
      const requests: Promise<any>[] = [];
      if (acceso.turno) requests.push(api.get<Turno>(`/api/turnos/${acceso.turno}/`));
      for (const id of acceso.equipos ?? []) requests.push(api.get<Equipo>(`/api/equipos/${id}/`));

      const results = await Promise.allSettled(requests);
      let index = 0;

      if (acceso.turno) {
        const turnoResult = results[index++];
        if (turnoResult.status === "fulfilled") setDetalleTurno(turnoResult.value.data);
      }

      const equipos: Equipo[] = [];
      for (; index < results.length; index += 1) {
        const result = results[index];
        if (result.status === "fulfilled") equipos.push(result.value.data);
      }

      setDetalleEquipos(equipos);
    } finally {
      setLoadingDetalle(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    cargarAccesos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, tipo, sede, aprendizId, guardaId, dDateFrom, dDateTo, pageSize]);

  useEffect(() => {
    cargarAccesos(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="space-y-4 pb-2">
      <PageHeader
        breadcrumb="ADMIN / ACCESOS"
        title="Accesos"
        description="Trazabilidad operativa por usuario, sede, tipo y ventana temporal con lectura mas clara."
        actions={
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-[1.05rem] border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-subtle)_98%,white),color-mix(in_srgb,var(--surface-muted)_92%,transparent))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            <Button onClick={() => cargarAccesos(page)} variant="secondary" className="px-3 py-1.5 text-[13px]">
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
            <MetricPanel label="Total" value={stats.total} detail="Registros visibles." />
            <MetricPanel label="Ingresos" value={stats.ingresos} detail="Entradas confirmadas." tone="success" />
            <MetricPanel label="Salidas" value={stats.salidas} detail="Egresos registrados." tone="danger" />
            <MetricPanel label="Con equipos" value={stats.conEquipos} detail="Eventos con activos." tone="warning" />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar
          footer={
            error ? (
              <div className="rounded-2xl border border-[color:rgba(255,107,122,0.28)] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] p-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null
          }
        >
          <label className="md:col-span-12 lg:col-span-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Buscar</div>
            <input
              className="command-noir-control h-10 w-full text-sm"
              placeholder="Documento o username"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Tipo</div>
            <select className="command-noir-control h-10 w-full text-sm" value={tipo} onChange={(event) => setTipo(event.target.value as "" | Acceso["tipo"])}>
              <option value="">Todos</option>
              <option value="ingreso">Ingreso</option>
              <option value="salida">Salida</option>
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-2">
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

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Aprendiz</div>
            <select
              className="command-noir-control h-10 w-full text-sm"
              value={aprendizId}
              onChange={(event) => setAprendizId(event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">Todos</option>
              {aprendicesAll.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {nombreUsuario(usuario)} ({usuario.documento ?? "sin doc"})
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Registrado</div>
            <select
              className="command-noir-control h-10 w-full text-sm"
              value={guardaId}
              onChange={(event) => setGuardaId(event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">Todos</option>
              {guardasAll.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {nombreUsuario(usuario)}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Desde</div>
            <input className="command-noir-control h-10 w-full" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>

          <label className="md:col-span-6 lg:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Hasta</div>
            <input className="command-noir-control h-10 w-full" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>

          <div className="md:col-span-6 lg:col-span-1">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-transparent">Reset</div>
            <Button onClick={resetFiltros} variant="secondary" disabled={!hasFilters} className="h-10 w-full px-3 text-[13px]">
              Limpiar
            </Button>
          </div>

          <div className="flex h-10 items-end justify-end md:col-span-12 lg:col-span-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-soft)]">{count} accesos</span>
            </div>
          </div>
        </FilterBar>
      )}

      <div className="space-y-3 text-[color:var(--color-text-soft)]">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={accesos.length > 0}
          tableClassName="min-w-[680px] xl:min-w-full table-fixed"
          headers={
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="hidden px-3 py-3 xl:table-cell">Sede</th>
              <th className="px-3 py-3">Aprendiz</th>
              <th className="hidden px-3 py-3 lg:table-cell">Registrado por</th>
              <th className="hidden px-3 py-3 md:table-cell">Equipos</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          }
          emptyState={
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <EmptyState
                    title="Sin registros con estos filtros"
                    description="Ajusta los filtros para continuar."
                    icon={<IconHistory className="h-5 w-5" />}
                  />
                </div>
              </td>
            </tr>
          }
        >
          {accesos.map((acceso) => {
            const aprendiz = usuariosMap.get(acceso.usuario);
            const registrado = acceso.registrado_por ? usuariosMap.get(acceso.registrado_por) : null;
            const equiposCount = (acceso.equipos ?? []).length;

            return (
              <tr key={acceso.id} className="command-noir-table-row">
                <td className="command-noir-table-cell px-3 py-3.5">
                  <div className="font-medium text-[color:var(--color-text)]">{formatFecha(acceso.fecha)}</div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">#{acceso.id}</div>
                </td>
                <td className="command-noir-table-cell px-3 py-3.5">
                  {acceso.tipo === "ingreso" ? <Badge variant="green" label="Ingreso" /> : <Badge variant="red" label="Salida" />}
                </td>
                <td className="command-noir-table-cell hidden px-3 py-3.5 xl:table-cell">
                  {acceso.sede ? <Badge variant="teal" label={sedesByCode.get(acceso.sede) || acceso.sede} /> : <Badge variant="gray" label="Sin sede" />}
                </td>
                <td className="command-noir-table-cell px-3 py-3.5">
                  <div className="font-semibold text-[color:var(--color-text)]">{nombreUsuario(aprendiz)}</div>
                  <div className="mt-0.5 text-[11.5px] text-[color:var(--color-text-muted)]">{aprendiz?.documento ?? "-"}</div>
                </td>
                <td className="command-noir-table-cell hidden px-3 py-3.5 lg:table-cell">
                  <div className="text-[color:var(--color-text)]">{registrado ? nombreUsuario(registrado) : "-"}</div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">{registrado?.username ?? ""}</div>
                </td>
                <td className="command-noir-table-cell hidden px-3 py-3.5 md:table-cell">
                  {equiposCount ? <Badge variant="amber" label={`${equiposCount} equipo${equiposCount > 1 ? "s" : ""}`} /> : <span className="text-[color:var(--color-text-muted)]">-</span>}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <Button onClick={() => abrirDetalle(acceso)} variant="secondary" className="rounded-xl px-2.5 py-1.5 text-[11px]">
                    Ver
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
        open={openDetalle}
        title={selected ? `Detalle del acceso #${selected.id}` : "Detalle"}
        onClose={() => {
          setOpenDetalle(false);
          setSelected(null);
          setDetalleTurno(null);
          setDetalleEquipos([]);
        }}
      >
        {!selected ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="command-noir-detail-card">
                <div className="text-xs text-[color:var(--color-text-muted)]">Fecha</div>
                <div className="font-semibold">{formatFecha(selected.fecha)}</div>
              </div>

              <div className="command-noir-detail-card">
                <div className="text-xs text-[color:var(--color-text-muted)]">Tipo</div>
                <div className="mt-1">
                  {selected.tipo === "ingreso" ? <Badge variant="green" label="Ingreso" /> : <Badge variant="red" label="Salida" />}
                </div>
              </div>

              <div className="command-noir-detail-card">
                <div className="text-xs text-[color:var(--color-text-muted)]">Sede</div>
                <div className="mt-1">
                  {selected.sede ? <Badge variant="teal" label={sedesByCode.get(selected.sede) || selected.sede} /> : <Badge variant="gray" label="Sin sede" />}
                </div>
              </div>

              <div className="command-noir-detail-card">
                <div className="text-xs text-[color:var(--color-text-muted)]">Turno</div>
                <div className="font-semibold">
                  {selected.turno ? `#${selected.turno}` : "-"}
                  {detalleTurno ? ` (${detalleTurno.activo ? "activo" : "finalizado"})` : ""}
                </div>
              </div>
            </div>

            <div className="command-noir-detail-card">
              <div className="text-sm font-bold text-[color:var(--color-text)]">Personas</div>
              <div className="mt-2 space-y-1 text-sm text-[color:var(--color-text-soft)]">
                <div>
                  <span className="text-[color:var(--color-text-muted)]">Aprendiz:</span>{" "}
                  <span className="font-medium">{nombreUsuario(usuariosMap.get(selected.usuario))}</span>
                </div>
                <div>
                  <span className="text-[color:var(--color-text-muted)]">Registrado por:</span>{" "}
                  <span className="font-medium">{selected.registrado_por ? nombreUsuario(usuariosMap.get(selected.registrado_por)) : "-"}</span>
                </div>
              </div>
            </div>

            <div className="command-noir-detail-card">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-[color:var(--color-text)]">Equipos</div>
                {loadingDetalle ? <div className="text-xs text-[color:var(--color-text-muted)]">Cargando...</div> : null}
              </div>

              <div className="mt-2">
                {(selected.equipos ?? []).length === 0 ? (
                  <div className="text-sm text-[color:var(--color-text-muted)]">Sin equipos asociados.</div>
                ) : detalleEquipos.length ? (
                  <div className="space-y-2">
                    {detalleEquipos.map((equipo) => (
                      <div
                        key={equipo.id}
                        className="flex items-center justify-between rounded-[1.05rem] border border-[color:var(--color-border-strong)] bg-[color:var(--surface-subtle)] p-3"
                      >
                        <div>
                          <div className="font-semibold text-[color:var(--color-text)]">{equipo.serial}</div>
                          <div className="text-xs text-[color:var(--color-text-muted)]">
                            {equipo.marca} {equipo.modelo} - propietario #{equipo.propietario}
                          </div>
                        </div>
                        <Badge
                          variant={
                            String(equipo.estado).toLowerCase() === "aprobado"
                              ? "green"
                              : String(equipo.estado).toLowerCase() === "rechazado"
                                ? "red"
                                : "amber"
                          }
                          label={
                            String(equipo.estado).toLowerCase() === "aprobado"
                              ? "Aprobado"
                              : String(equipo.estado).toLowerCase() === "rechazado"
                                ? "Rechazado"
                                : "Pendiente"
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--color-text-soft)]">
                    IDs: {(selected.equipos ?? []).join(", ")} <span className="text-xs text-[color:var(--color-text-muted)]">(sin detalles)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
