"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import AdminTableSkeleton from "@/components/dashboard/shared/AdminTableSkeleton";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import Button from "@/components/dashboard/shared/Button";
import { IconHistory } from "@/components/aprendiz/dashboard/DashboardIcons";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import { useSedes } from "@/hooks/useSedes";

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
  jornada: "MANANA" | "MAÃ‘ANA" | "TARDE" | "NOCHE";
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

function clsBadge(variant: "green" | "red" | "blue" | "amber" | "gray") {
  if (variant === "green") return "success";
  if (variant === "red") return "danger";
  if (variant === "blue") return "info";
  if (variant === "amber") return "warning";
  return "neutral";
}

function Badge({
  variant,
  label,
}: {
  variant: "green" | "red" | "blue" | "amber" | "gray";
  label: string;
}) {
  return <span className="command-noir-chip" data-tone={clsBadge(variant)}>{label}</span>;
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "â€”";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function formatFecha(iso?: string | null) {
  if (!iso) return "â€”";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "â€”";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function StatSkeleton() {
  return <div className="command-noir-metric h-[110px] animate-pulse" />;
}

function FilterSkeleton() {
  return (
    <section className="sadi-card-strong rounded-[1.55rem] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-12 lg:col-span-5" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-3" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-6 lg:col-span-1" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-12 lg:col-span-2" />
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
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <article className="command-noir-metric">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{label}</p>
          <p className="mt-2.5 text-[1.65rem] font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">{value.toLocaleString("es-CO")}</p>
        </div>
        <span className="command-noir-chip" data-tone={tone}>{detail}</span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--color-text-soft)]">
        {label === "Total"
          ? "Ledger operativo del rango filtrado."
          : label === "Ingresos"
            ? "Flujo de entradas registradas con trazabilidad."
            : label === "Salidas"
              ? "Eventos de salida confirmados en el periodo."
              : "Registros con activos asociados listos para auditoria."}
      </p>
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
    const m = new Map<number, Usuario>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const aprendicesAll = useMemo(() => usuarios.filter((u) => u.rol === "aprendiz"), [usuarios]);
  const guardasAll = useMemo(() => usuarios.filter((u) => u.rol === "guarda"), [usuarios]);

  const stats = useMemo(() => {
    const total = count;
    const ingresos = accesos.filter((a) => a.tipo === "ingreso").length;
    const salidas = accesos.filter((a) => a.tipo === "salida").length;
    const conEquipos = accesos.filter((a) => (a.equipos ?? []).length > 0).length;
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
  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    (tipo !== "" ? 1 : 0) +
    (sede !== "" ? 1 : 0) +
    (aprendizId !== "" ? 1 : 0) +
    (guardaId !== "" ? 1 : 0) +
    (dateFrom !== "" ? 1 : 0) +
    (dateTo !== "" ? 1 : 0);

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
      const params: any = { page: p, page_size: pageSize };
      if (dq.trim()) params.q = dq.trim();
      if (tipo) params.tipo = tipo;
      if (sede) params.sede = sede;
      if (aprendizId !== "") params.usuario = aprendizId;
      if (guardaId !== "") params.registrado_por = guardaId;
      if (dDateFrom) params.date_from = dDateFrom;
      if (dDateTo) params.date_to = dDateTo;

      const r = await api.get<Paginated<Acceso> | Acceso[]>("/api/accesos/", { params });
      const payload: any = r.data;
      const results = Array.isArray(payload) ? payload : payload.results ?? [];
      const c = Array.isArray(payload) ? results.length : payload.count ?? results.length;

      if (rid !== requestIdRef.current) return;
      setAccesos(results);
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

  async function abrirDetalle(a: Acceso) {
    setSelected(a);
    setOpenDetalle(true);
    setDetalleTurno(null);
    setDetalleEquipos([]);
    setLoadingDetalle(true);

    try {
      const promises: Promise<any>[] = [];
      if (a.turno) promises.push(api.get<Turno>(`/api/turnos/${a.turno}/`));
      for (const id of a.equipos ?? []) promises.push(api.get<Equipo>(`/api/equipos/${id}/`));
      const results = await Promise.allSettled(promises);

      let idx = 0;
      if (a.turno) {
        const tr = results[idx++];
        if (tr.status === "fulfilled") setDetalleTurno(tr.value.data);
      }
      const eqs: Equipo[] = [];
      for (; idx < results.length; idx++) {
        const rr = results[idx];
        if (rr.status === "fulfilled") eqs.push(rr.value.data);
      }
      setDetalleEquipos(eqs);
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
  const selectedAprendiz = aprendizId === "" ? null : usuariosMap.get(aprendizId);
  const selectedGuarda = guardaId === "" ? null : usuariosMap.get(guardaId);

  return (
    <div className="space-y-4 pb-2">
      <PageHeader
        breadcrumb="ADMIN > ACCESOS"
        title="Accesos"
        description="Ledger operativo premium para auditar eventos por usuario, sede, tipo y ventana temporal sin perder claridad."
        actions={
          <>
            <Button onClick={() => cargarAccesos(page)} variant="secondary" className="min-w-[132px]">
              Recargar
            </Button>
          </>
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
            <MetricPanel label="Total" value={stats.total} detail={`${count} registros`} />
            <MetricPanel label="Ingresos" value={stats.ingresos} detail="flujo activo" tone="success" />
            <MetricPanel label="Salidas" value={stats.salidas} detail="egreso trazado" tone="danger" />
            <MetricPanel label="Con equipos" value={stats.conEquipos} detail="cadena completa" tone="warning" />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar
          footer={
            error ? <div className="rounded-2xl border border-[color:rgba(255,107,122,0.28)] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] p-3 text-sm text-[color:var(--danger)]">{error}</div> : null
          }
        >
          <div className="md:col-span-12">
            <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Lectura operativa</p>
                <p className="mt-1 text-sm text-[color:var(--color-text)]">
                  {accesos.length
                    ? `${accesos.length} accesos visibles en la página actual.${selectedAprendiz ? ` Aprendiz enfocado: ${nombreUsuario(selectedAprendiz)}.` : ""}${selectedGuarda ? ` Guarda: ${nombreUsuario(selectedGuarda)}.` : ""}`
                    : "Combina filtros para auditar ingresos, salidas y movimientos con equipos asociados."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="command-noir-chip whitespace-nowrap" data-tone={hasFilters ? "info" : "neutral"}>
                  {activeFilterCount} filtro(s)
                </span>
                <span className="command-noir-chip whitespace-nowrap" data-tone={stats.conEquipos > 0 ? "warning" : "neutral"}>
                  {stats.conEquipos} con equipos
                </span>
                <span className="command-noir-chip whitespace-nowrap" data-tone="neutral">
                  {count} accesos
                </span>
              </div>
            </div>
          </div>

          <input
            className="command-noir-control h-10 w-full md:col-span-12 lg:col-span-4"
            placeholder="Documento, username o referencia rápida"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="command-noir-control h-10 w-full md:col-span-6 lg:col-span-2"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
          >
            <option value="">Tipo</option>
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
          </select>

          <select
            className="command-noir-control h-10 w-full md:col-span-6 lg:col-span-2"
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
            className="command-noir-control h-10 w-full md:col-span-6 lg:col-span-2"
            value={aprendizId}
            onChange={(e) => setAprendizId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Aprendiz</option>
            {aprendicesAll.map((u) => (
              <option key={u.id} value={u.id}>
                {nombreUsuario(u)} ({u.documento ?? "sin doc"})
              </option>
            ))}
          </select>

          <select
            className="command-noir-control h-10 w-full md:col-span-6 lg:col-span-2"
            value={guardaId}
            onChange={(e) => setGuardaId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Guarda</option>
            {guardasAll.map((u) => (
              <option key={u.id} value={u.id}>
                {nombreUsuario(u)}
              </option>
            ))}
          </select>

          <div className="md:col-span-6 lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Desde</label>
              <input
                className="command-noir-control h-10 w-full"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 lg:col-span-2">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Hasta</label>
              <input
                className="command-noir-control h-10 w-full"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 lg:col-span-1">
            <Button onClick={resetFiltros} variant="secondary" disabled={!hasFilters}>
              Limpiar
            </Button>
          </div>

          <div className="flex h-10 items-center justify-end md:col-span-12 lg:col-span-2">
            <span className="command-noir-chip whitespace-nowrap" data-tone="neutral">
              {count} accesos
            </span>
          </div>
        </FilterBar>
      )}

      <div className="space-y-4 text-[color:var(--color-text-soft)]">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={accesos.length > 0}
          tableClassName="min-w-[680px] xl:min-w-full table-fixed"
          headers={
            <tr className="text-left">
              <th className="px-2.5 py-2 font-semibold">Fecha</th>
              <th className="px-2.5 py-2 font-semibold">Tipo</th>
              <th className="hidden px-2.5 py-2 font-semibold xl:table-cell">Sede</th>
              <th className="px-2.5 py-2 font-semibold">Aprendiz</th>
              <th className="hidden px-2.5 py-2 font-semibold lg:table-cell">Registrado por</th>
              <th className="hidden px-2.5 py-2 font-semibold md:table-cell">Equipos</th>
              <th className="px-2.5 py-2 text-right font-semibold">Acciones</th>
            </tr>
          }
          emptyState={
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center">
                <div className="mx-auto max-w-md">
                  <EmptyState
                    title="Sin accesos en esta vista"
                    description={hasFilters ? "Ajusta o limpia filtros para recuperar movimientos." : "Todavía no hay movimientos registrados en este listado."}
                    icon={<IconHistory className="h-5 w-5" />}
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
          {accesos.map((a) => {
            const aprendiz = usuariosMap.get(a.usuario);
            const registrado = a.registrado_por ? usuariosMap.get(a.registrado_por) : null;
            const equiposCount = (a.equipos ?? []).length;

            return (
              <tr key={a.id} className="command-noir-table-row">
                <td className="command-noir-table-cell px-2.5 py-2 text-[color:var(--color-text-soft)]">
                  <div>{formatFecha(a.fecha)}</div>
                  <div className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">Acceso #{a.id}</div>
                </td>
                <td className="command-noir-table-cell px-2.5 py-2">
                  {a.tipo === "ingreso" ? <Badge variant="green" label="Ingreso" /> : <Badge variant="red" label="Salida" />}
                </td>
                <td className="command-noir-table-cell hidden px-2.5 py-2 xl:table-cell">
                  {a.sede ? (
                    <Badge variant="blue" label={sedesByCode.get(a.sede) || a.sede} />
                  ) : (
                    <Badge variant="gray" label="(sin sede)" />
                  )}
                </td>
                <td className="command-noir-table-cell px-2.5 py-2">
                  <div className="font-semibold text-[color:var(--color-text)]">{nombreUsuario(aprendiz)}</div>
                  <div className="text-xs text-[color:var(--color-text-muted)]">{aprendiz?.documento ?? "â€”"}</div>
                  <div className="mt-1 space-y-1 text-[11px] text-[color:var(--color-text-muted)] lg:hidden">
                    <div>{registrado ? `Registró: ${nombreUsuario(registrado)}` : "Sin guarda asociado"}</div>
                    <div>
                      {equiposCount ? `${equiposCount} equipo(s) asociado(s)` : "Sin equipos asociados"}
                    </div>
                  </div>
                </td>
                <td className="command-noir-table-cell hidden px-2.5 py-2 text-[color:var(--color-text-soft)] lg:table-cell">
                  <div>{registrado ? nombreUsuario(registrado) : "â€”"}</div>
                  <div className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">Turno y contexto ampliado en el detalle</div>
                </td>
                <td className="command-noir-table-cell hidden px-2.5 py-2 md:table-cell">
                  {equiposCount ? (
                    <div className="flex flex-col gap-1.5">
                      <Badge variant="amber" label={`${equiposCount} equipo(s)`} />
                      <span className="text-[11px] text-[color:var(--color-text-muted)]">Incluidos en la trazabilidad del evento</span>
                    </div>
                  ) : (
                    "â€”"
                  )}
                </td>
                <td className="px-2.5 py-2 text-right">
                  <Button onClick={() => abrirDetalle(a)} variant="secondary" className="min-h-8 px-3 py-1 text-xs">
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
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
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
                  {selected.sede ? (
                    <Badge variant="blue" label={sedesByCode.get(selected.sede) || selected.sede} />
                  ) : (
                    <Badge variant="gray" label="(sin sede)" />
                  )}
                </div>
              </div>

              <div className="command-noir-detail-card">
                <div className="text-xs text-[color:var(--color-text-muted)]">Turno</div>
                <div className="font-semibold">
                  {selected.turno ? `#${selected.turno}` : "â€”"}
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
                  <span className="font-medium">
                    {selected.registrado_por ? nombreUsuario(usuariosMap.get(selected.registrado_por)) : "â€”"}
                  </span>
                </div>
              </div>
            </div>

            {selected.turno ? (
              <div className="command-noir-detail-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-[color:var(--color-text)]">Contexto del turno</div>
                  {loadingDetalle ? <div className="text-xs text-[color:var(--color-text-muted)]">Cargando...</div> : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Jornada</div>
                    <div className="mt-1 font-semibold text-[color:var(--color-text)]">{detalleTurno?.jornada ?? "Pendiente de cargar"}</div>
                  </div>
                  <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Inicio</div>
                    <div className="mt-1 font-semibold text-[color:var(--color-text)]">{detalleTurno ? formatFecha(detalleTurno.inicio) : "Pendiente de cargar"}</div>
                  </div>
                  <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Cierre</div>
                    <div className="mt-1 font-semibold text-[color:var(--color-text)]">{detalleTurno ? formatFecha(detalleTurno.fin) : "Pendiente de cargar"}</div>
                  </div>
                </div>
              </div>
            ) : null}

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
                    {detalleEquipos.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-[1.1rem] border border-[color:var(--color-border-strong)] bg-[color:var(--surface-subtle)] p-3">
                        <div>
                          <div className="font-semibold text-[color:var(--color-text)]">{e.serial}</div>
                          <div className="text-xs text-[color:var(--color-text-muted)]">
                            {e.marca} {e.modelo} - propietario #{e.propietario}
                          </div>
                        </div>
                        <Badge
                          variant={
                            String(e.estado).toLowerCase() === "aprobado"
                              ? "green"
                              : String(e.estado).toLowerCase() === "rechazado"
                                ? "red"
                                : "amber"
                          }
                          label={
                            String(e.estado).toLowerCase() === "aprobado"
                              ? "Aprobado"
                              : String(e.estado).toLowerCase() === "rechazado"
                                ? "Rechazado"
                                : "Pendiente"
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--color-text-soft)]">
                    IDs: {(selected.equipos ?? []).join(", ")}{" "}
                    <span className="text-xs text-[color:var(--color-text-muted)]">(sin detalles)</span>
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
