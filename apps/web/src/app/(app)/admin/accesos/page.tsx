"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import DataTable from "@/components/dashboard/shared/DataTable";
import EmptyState from "@/components/dashboard/shared/EmptyState";
import Button from "@/components/dashboard/shared/Button";
import { IconHistory } from "@/components/aprendiz/dashboard/DashboardIcons";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
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
  sede: "CEGAFE" | "SANTA_CLARA" | "ITEDRIS" | "GASTRONOMIA";
  jornada: "MANANA" | "MAÑANA" | "TARDE" | "NOCHE";
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
  sede: "CEGAFE" | "SANTA_CLARA" | "ITEDRIS" | "GASTRONOMIA" | null;
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

const SEDES: Array<NonNullable<Acceso["sede"]>> = ["CEGAFE", "SANTA_CLARA", "ITEDRIS", "GASTRONOMIA"];

function clsBadge(variant: "green" | "red" | "blue" | "amber" | "gray") {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (variant === "green") return `${base} border-emerald-200 bg-emerald-100 text-emerald-800`;
  if (variant === "red") return `${base} border-rose-200 bg-rose-100 text-rose-800`;
  if (variant === "blue") return `${base} border-sky-200 bg-sky-100 text-sky-800`;
  if (variant === "amber") return `${base} border-amber-200 bg-amber-100 text-amber-800`;
  return `${base} border-zinc-200 bg-zinc-100 text-zinc-700`;
}

function Badge({
  variant,
  label,
}: {
  variant: "green" | "red" | "blue" | "amber" | "gray";
  label: string;
}) {
  return <span className={clsBadge(variant)}>{label}</span>;
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
  return <div className="h-[92px] animate-pulse rounded-2xl border bg-white p-4 shadow-sm" />;
}

function FilterSkeleton() {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
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

export default function AdminAccesosPage() {
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
  const [sede, setSede] = useState<"" | NonNullable<Acceso["sede"]>>("");
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

  return (
    <div className="space-y-7 pb-2">
      <PageHeader
        breadcrumb="ADMIN > ACCESOS"
        title="Accesos"
        description="Paginado y filtros por usuario, sede, tipo y rango de fechas."
        actions={
          <>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/pagina
                </option>
              ))}
            </select>

            <Button onClick={() => cargarAccesos(page)} variant="secondary">
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
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Ingresos" value={stats.ingresos} tone="success" />
            <StatCard label="Salidas" value={stats.salidas} tone="danger" />
            <StatCard label="Con equipos" value={stats.conEquipos} tone="warning" />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar
          footer={
            error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null
          }
        >
          <input
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-12 lg:col-span-5"
            placeholder="Buscar por documento o username..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-2"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
          >
            <option value="">Tipo</option>
            <option value="ingreso">Ingreso</option>
            <option value="salida">Salida</option>
          </select>

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-2"
            value={sede}
            onChange={(e) => setSede(e.target.value as any)}
          >
            <option value="">Sede</option>
            {SEDES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-3"
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
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:col-span-6 lg:col-span-3"
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
            <label className="text-xs text-gray-500">Desde</label>
            <input
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 lg:col-span-2">
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
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

          <div className="flex h-11 items-center justify-end md:col-span-12 lg:col-span-2">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 whitespace-nowrap">
              {count} accesos
            </span>
          </div>
        </FilterBar>
      )}

      <div className="space-y-4">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton />}
          hasRows={accesos.length > 0}
          tableClassName="min-w-[1050px]"
          headers={
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Sede</th>
              <th className="px-4 py-3 font-semibold">Aprendiz</th>
              <th className="px-4 py-3 font-semibold">Registrado por</th>
              <th className="px-4 py-3 font-semibold">Equipos</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
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
          {accesos.map((a) => {
            const aprendiz = usuariosMap.get(a.usuario);
            const registrado = a.registrado_por ? usuariosMap.get(a.registrado_por) : null;
            const equiposCount = (a.equipos ?? []).length;

            return (
              <tr key={a.id} className="transition hover:bg-sky-50/35">
                <td className="px-4 py-3 whitespace-nowrap">{formatFecha(a.fecha)}</td>
                <td className="px-4 py-3">
                  {a.tipo === "ingreso" ? <Badge variant="green" label="Ingreso" /> : <Badge variant="red" label="Salida" />}
                </td>
                <td className="px-4 py-3">
                  {a.sede ? <Badge variant="blue" label={a.sede.replace("_", " ")} /> : <Badge variant="gray" label="(sin sede)" />}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{nombreUsuario(aprendiz)}</div>
                  <div className="text-xs text-gray-500">{aprendiz?.documento ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-gray-800">{registrado ? nombreUsuario(registrado) : "—"}</td>
                <td className="px-4 py-3">
                  {equiposCount ? <Badge variant="amber" label={`${equiposCount} equipo(s)`} /> : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button onClick={() => abrirDetalle(a)} variant="secondary" className="px-3 py-1.5 text-xs">
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
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>

      <Modal
        open={openDetalle}
        title={selected ? `Detalle acceso #${selected.id}` : "Detalle"}
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
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="font-semibold">{formatFecha(selected.fecha)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Tipo</div>
                <div className="mt-1">
                  {selected.tipo === "ingreso" ? <Badge variant="green" label="Ingreso" /> : <Badge variant="red" label="Salida" />}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Sede</div>
                <div className="mt-1">
                  {selected.sede ? <Badge variant="blue" label={selected.sede.replace("_", " ")} /> : <Badge variant="gray" label="(sin sede)" />}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Turno</div>
                <div className="font-semibold">
                  {selected.turno ? `#${selected.turno}` : "—"}
                  {detalleTurno ? ` (${detalleTurno.activo ? "activo" : "finalizado"})` : ""}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="text-sm font-bold text-gray-900">Personas</div>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                <div>
                  <span className="text-gray-500">Aprendiz:</span>{" "}
                  <span className="font-medium">{nombreUsuario(usuariosMap.get(selected.usuario))}</span>
                </div>
                <div>
                  <span className="text-gray-500">Registrado por:</span>{" "}
                  <span className="font-medium">
                    {selected.registrado_por ? nombreUsuario(usuariosMap.get(selected.registrado_por)) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-gray-900">Equipos</div>
                {loadingDetalle ? <div className="text-xs text-gray-500">Cargando...</div> : null}
              </div>

              <div className="mt-2">
                {(selected.equipos ?? []).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin equipos asociados.</div>
                ) : detalleEquipos.length ? (
                  <div className="space-y-2">
                    {detalleEquipos.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <div className="font-semibold text-gray-900">{e.serial}</div>
                          <div className="text-xs text-gray-500">
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
                  <div className="text-sm text-gray-600">
                    IDs: {(selected.equipos ?? []).join(", ")}{" "}
                    <span className="text-xs text-gray-500">(sin detalles)</span>
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
