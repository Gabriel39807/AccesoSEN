"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";

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
  jornada: "MAÑANA" | "TARDE" | "NOCHE";
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
  const base = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border";
  if (variant === "green") return `${base} bg-emerald-100 text-emerald-800 border-emerald-200`;
  if (variant === "red") return `${base} bg-rose-100 text-rose-800 border-rose-200`;
  if (variant === "blue") return `${base} bg-sky-100 text-sky-800 border-sky-200`;
  if (variant === "amber") return `${base} bg-amber-100 text-amber-800 border-amber-200`;
  return `${base} bg-gray-100 text-gray-800 border-gray-200`;
}

function Badge({ variant, label }: { variant: "green" | "red" | "blue" | "amber" | "gray"; label: string }) {
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
    "Ocurrió un error."
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
  return <div className="rounded-2xl border bg-white shadow-sm p-4 animate-pulse h-[92px]" />;
}
function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function AdminAccesosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // tabla paginada
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros (API)
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"" | Acceso["tipo"]>("");
  const [sede, setSede] = useState<"" | NonNullable<Acceso["sede"]>>("");
  const [aprendizId, setAprendizId] = useState<number | "">("");
  const [guardaId, setGuardaId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // búsqueda selects
  const [aprendizSearch, setAprendizSearch] = useState("");
  const [guardaSearch, setGuardaSearch] = useState("");

  // debounce
  const dq = useDebounced(q, 450);
  const dAprendizSearch = useDebounced(aprendizSearch, 450);
  const dGuardaSearch = useDebounced(guardaSearch, 450);
  const dDateFrom = useDebounced(dateFrom, 450);
  const dDateTo = useDebounced(dateTo, 450);

  // detalle
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

  const aprendicesFiltrados = useMemo(() => {
    const s = dAprendizSearch.trim().toLowerCase();
    if (!s) return aprendicesAll;
    return aprendicesAll.filter((u) =>
      `${u.username} ${u.first_name ?? ""} ${u.last_name ?? ""} ${u.documento ?? ""}`.toLowerCase().includes(s)
    );
  }, [aprendicesAll, dAprendizSearch]);

  const guardasFiltrados = useMemo(() => {
    const s = dGuardaSearch.trim().toLowerCase();
    if (!s) return guardasAll;
    return guardasAll.filter((u) =>
      `${u.username} ${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(s)
    );
  }, [guardasAll, dGuardaSearch]);

  const stats = useMemo(() => {
    const total = count;
    const ingresos = accesos.filter((a) => a.tipo === "ingreso").length;
    const salidas = accesos.filter((a) => a.tipo === "salida").length;
    const conEquipos = accesos.filter((a) => (a.equipos ?? []).length > 0).length;
    return { total, ingresos, salidas, conEquipos };
  }, [accesos, count]);

  async function cargarUsuarios() {
    const res = await api.get<Usuario[] | Paginated<Usuario>>("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    setUsuarios(data);
  }

  async function cargarAccesos(p = page) {
    const rid = ++requestIdRef.current; // evita race conditions
    setLoadingTable(true);
    setError(null);

    try {
      const params: any = {
        page: p,
        page_size: pageSize, // DRF lo acepta si habilitas PageNumberPagination (por defecto sí)
      };
      if (dq.trim()) params.q = dq.trim();
      if (tipo) params.tipo = tipo;
      if (sede) params.sede = sede;
      if (aprendizId !== "") params.usuario = aprendizId;
      if (guardaId !== "") params.registrado_por = guardaId;
      if (dDateFrom) params.date_from = dDateFrom;
      if (dDateTo) params.date_to = dDateTo;

      const r = await api.get<Paginated<Acceso> | Acceso[]>("/api/accesos/", { params });

      // si todavía no tienes paginación, soporta array
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
    setAprendizSearch("");
    setGuardaSearch("");
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

  // ✅ Cargar inicial
  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Auto-refetch con debounce cuando cambian filtros “de request”
  useEffect(() => {
    // cuando cambian filtros, vuelvo a page=1
    setPage(1);
    cargarAccesos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, tipo, sede, aprendizId, guardaId, dDateFrom, dDateTo, pageSize]);

  // ✅ refetch cuando cambie page
  useEffect(() => {
    cargarAccesos(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Admin / Accesos</h1>
            <p className="text-sm text-gray-500">
              Paginado + filtros con debounce + skeleton loaders.
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <select
              className="rounded-xl border px-3 py-2 text-sm bg-white"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/página
                </option>
              ))}
            </select>

            <button
              onClick={() => cargarAccesos(page)}
              className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
            >
              Recargar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-4">
          {loading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <div className="text-sm text-gray-500">En esta página: Ingresos</div>
                <div className="text-2xl font-bold text-emerald-700">{stats.ingresos}</div>
              </div>
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <div className="text-sm text-gray-500">En esta página: Salidas</div>
                <div className="text-2xl font-bold text-rose-700">{stats.salidas}</div>
              </div>
              <div className="rounded-2xl border bg-white shadow-sm p-4">
                <div className="text-sm text-gray-500">En esta página: Con equipos</div>
                <div className="text-2xl font-bold text-gray-900">{stats.conEquipos}</div>
              </div>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              className="md:col-span-4 w-full rounded-xl border px-3 py-2 text-sm bg-white"
              placeholder="Buscar por documento o username…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              className="md:col-span-2 w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
            >
              <option value="">Tipo</option>
              <option value="ingreso">Ingreso</option>
              <option value="salida">Salida</option>
            </select>

            <select
              className="md:col-span-2 w-full rounded-xl border px-3 py-2 text-sm bg-white"
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

            <div className="md:col-span-2 space-y-1">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                placeholder="Buscar aprendiz…"
                value={aprendizSearch}
                onChange={(e) => setAprendizSearch(e.target.value)}
              />
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={aprendizId}
                onChange={(e) => setAprendizId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Aprendiz</option>
                {aprendicesFiltrados.map((u) => (
                  <option key={u.id} value={u.id}>
                    {nombreUsuario(u)} ({u.documento ?? "sin doc"})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                placeholder="Buscar guarda…"
                value={guardaSearch}
                onChange={(e) => setGuardaSearch(e.target.value)}
              />
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={guardaId}
                onChange={(e) => setGuardaId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Guarda</option>
                {guardasFiltrados.map((u) => (
                  <option key={u.id} value={u.id}>
                    {nombreUsuario(u)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500">Desde</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500">Hasta</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="md:col-span-6 flex items-end gap-2">
              <button
                onClick={() => resetFiltros()}
                className="rounded-xl px-4 py-2 border bg-white hover:bg-gray-50 transition"
              >
                Limpiar
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </div>
          ) : null}
        </div>

        {/* Table */}
        {loadingTable ? (
          <TableSkeleton />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="text-sm text-gray-600">
                Resultados: <span className="font-semibold">{count}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Sede</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Aprendiz</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Registrado por</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Equipos</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {accesos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Sin registros con estos filtros.
                      </td>
                    </tr>
                  ) : null}

                  {accesos.map((a) => {
                    const aprendiz = usuariosMap.get(a.usuario);
                    const registrado = a.registrado_por ? usuariosMap.get(a.registrado_por) : null;
                    const equiposCount = (a.equipos ?? []).length;

                    return (
                      <tr key={a.id} className="border-b hover:bg-emerald-50/30 transition">
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
                          <button
                            onClick={() => abrirDetalle(a)}
                            className="rounded-xl px-3 py-2 text-xs font-semibold border bg-white hover:bg-gray-50 transition"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalCount={count}
                pageSize={pageSize}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          </div>
        )}

        {/* Modal detalle */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="font-semibold">{selected.turno ? `#${selected.turno}` : "—"}</div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-bold text-gray-900">Personas</div>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
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
                  {loadingDetalle ? <div className="text-xs text-gray-500">Cargando…</div> : null}
                </div>

                <div className="mt-2">
                  {(selected.equipos ?? []).length === 0 ? (
                    <div className="text-sm text-gray-500">Sin equipos asociados.</div>
                  ) : detalleEquipos.length ? (
                    <div className="space-y-2">
                      {detalleEquipos.map((e) => (
                        <div key={e.id} className="rounded-xl border p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{e.serial}</div>
                            <div className="text-xs text-gray-500">
                              {e.marca} {e.modelo} • propietario #{e.propietario}
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
                      <span className="text-xs text-gray-500">(no se pudieron cargar detalles)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

