"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import BadgeChip from "@/components/admin/BadgeChip";
import FilterBar from "@/components/admin/FilterBar";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { useInstitution } from "@/context/institution-context";

type Usuario = {
  id: number;
  username: string;
  email?: string | null;
  rol?: "admin" | "aprendiz" | "guarda" | string;
  estado?: string;
  first_name?: string;
  last_name?: string;
  sede_principal?: string | null;
  programa_formacion?: string | null;
  documento?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ImportValidationError = {
  row: number;
  code: string;
  message: string;
  field?: string | null;
  fields?: string[];
};

const ROLES = ["admin", "guarda", "aprendiz"] as const;
const SEDES = ["CEGAFE", "SANTA_CLARA", "ITEDRIS", "GASTRONOMIA"] as const;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function useDebounced<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function safeErrorMessage(e: any) {
  return (
    (typeof e?.response?.data?.message === "string" ? e.response.data.message : null) ??
    (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : null) ??
    (typeof e?.response?.data?.motivo === "string" ? e.response.data.motivo : null) ??
    e?.response?.data?.detail ??
    e?.response?.data?.motivo ??
    (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ??
    e?.message ??
    "No se pudo completar la acciÃ³n."
  );
}

function StatSkeleton() {
  return (
    <div className="text-left bg-white rounded-2xl shadow-sm border p-4 animate-pulse">
      <div className="h-6 w-6 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
      <div className="h-6 w-10 bg-gray-200 rounded" />
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {/* Tabla skeleton (misma â€œcajaâ€ que tu tabla real) */}
      <div className="overflow-auto bg-white rounded-2xl shadow-sm border">
        <table className="min-w-full text-sm">
          {/* Mantener el header real (como en tu tabla) da contexto y se ve pro */}
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="p-3">ID</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Documento</th>
              <th className="p-3">Sede</th>
              <th className="p-3">Programa</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="hover:bg-primary/10 transition">
                {/* ID */}
                <td className="p-3">
                  <div className="h-4 w-10 rounded sadi-skeleton" />
                </td>

                {/* Usuario (2 lÃ­neas: username + email) */}
                <td className="p-3">
                  <div className="h-4 w-28 rounded sadi-skeleton" />
                  <div className="mt-2 h-3 w-40 rounded sadi-skeleton" />
                </td>

                {/* Nombre */}
                <td className="p-3">
                  <div className="h-4 w-36 rounded sadi-skeleton" />
                </td>

                {/* Rol (pill + select como en tu UI real) */}
                <td className="p-3">
                  <div className="flex flex-col gap-2">
                    <div className="h-6 w-24 rounded-full sadi-skeleton" />
                    <div className="h-10 w-28 rounded-xl sadi-skeleton" />
                  </div>
                </td>

                {/* Estado (pill + select) */}
                <td className="p-3">
                  <div className="flex flex-col gap-2">
                    <div className="h-6 w-24 rounded-full sadi-skeleton" />
                    <div className="h-10 w-28 rounded-xl sadi-skeleton" />
                  </div>
                </td>

                {/* Documento */}
                <td className="p-3">
                  <div className="h-4 w-24 rounded sadi-skeleton" />
                </td>

                {/* Sede */}
                <td className="p-3">
                  <div className="h-4 w-20 rounded sadi-skeleton" />
                </td>

                {/* Programa */}
                <td className="p-3">
                  <div className="h-4 w-32 rounded sadi-skeleton" />
                </td>

                {/* Acciones (botÃ³n) */}
                <td className="p-3">
                  <div className="h-10 w-24 rounded-xl sadi-skeleton" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PaginaciÃ³n skeleton (misma caja que tu paginaciÃ³n real) */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border p-3 mt-4">
        <div className="h-4 w-40 rounded sadi-skeleton" />

        <div className="flex items-center gap-2">
          <div className="h-10 w-24 rounded-xl sadi-skeleton" />
          <div className="h-10 w-24 rounded-xl sadi-skeleton" />
        </div>
      </div>
    </>
  );
}


export default function AdminUsuariosPage() {
  const { emailPlaceholder } = useInstitution();
  // data
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [count, setCount] = useState<number>(0);
  const [serverPaginated, setServerPaginated] = useState<boolean>(false);

  // loading/error
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI controls
  const [q, setQ] = useState("");
  const [rolFilter, setRolFilter] = useState<"todos" | "admin" | "guarda" | "aprendiz">("todos");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activo" | "bloqueado">("todos");
  const [sedeFilter, setSedeFilter] = useState<"todos" | (typeof SEDES)[number]>("todos");

  // debounce
  const dq = useDebounced(q, 450);
  const dRol = useDebounced(rolFilter, 350);
  const dEstado = useDebounced(estadoFilter, 350);
  const dSede = useDebounced(sedeFilter, 350);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // modal editar
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Usuario | null>(null);

  // form state (editar modal)
  const [rol, setRol] = useState<string>("aprendiz");
  const [estado, setEstado] = useState<string>("activo");
  const [sede, setSede] = useState<string>("");
  const [programa, setPrograma] = useState<string>("");
  const [documento, setDocumento] = useState<string>("");
  const [email, setEmail] = useState("");

  // modal crear
  const [openCrear, setOpenCrear] = useState(false);
  const [creating, setCreating] = useState(false);

  const [c_username, setCUsername] = useState("");
  const [c_password, setCPassword] = useState("");
  const [c_first, setCFirst] = useState("");
  const [c_last, setCLast] = useState("");
  const [c_email, setCEmail] = useState("");
  const [c_documento, setCDocumento] = useState("");
  const [c_rol, setCRol] = useState<string>("aprendiz");
  const [c_estado, setCEstado] = useState<string>("activo");
  const [c_sede, setCSede] = useState<string>("");
  const [c_programa, setCPrograma] = useState("");

  // modal importar aprendices (excel 2 fases)
  const [openImportar, setOpenImportar] = useState(false);
  const [validandoImport, setValidandoImport] = useState(false);
  const [confirmandoImport, setConfirmandoImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string>("");
  const [importResumen, setImportResumen] = useState<{ validos: number; errores: number; total: number } | null>(null);
  const [importErrores, setImportErrores] = useState<ImportValidationError[]>([]);

  const requestIdRef = useRef(0);

  async function cargar(p = page) {
    const rid = ++requestIdRef.current;

    setError(null);
    setLoadingTable(true);
    if (usuarios.length === 0) setLoading(true);

    try {
      const params: any = { page: p, page_size: pageSize };

      // filtros (si tu backend los soporta)
      if (dq.trim()) params.q = dq.trim();
      if (dRol !== "todos") params.rol = dRol;
      if (dEstado !== "todos") params.estado = dEstado;
      if (dSede !== "todos") params.sede_principal = dSede;

      const res = await api.get<Paginated<Usuario> | Usuario[]>("/api/usuarios/", { params });
      const payload: any = res.data;

      if (rid !== requestIdRef.current) return;

      if (Array.isArray(payload)) {
        // fallback: backend sin paginaciÃ³n
        setServerPaginated(false);
        setUsuarios(payload);
        setCount(payload.length);
      } else {
        setServerPaginated(true);
        setUsuarios(payload?.results ?? []);
        setCount(payload?.count ?? (payload?.results?.length ?? 0));
      }
    } catch (e: any) {
      if (rid !== requestIdRef.current) return;
      setError(safeErrorMessage(e));
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setLoadingTable(false);
      }
    }
  }

  useEffect(() => {
    cargar(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recargar al cambiar filtros debounced
  useEffect(() => {
    setPage(1);
    cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, dRol, dEstado, dSede]);

  // recargar al cambiar page
  useEffect(() => {
    cargar(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // fallback client-side filtering/pagination (solo si backend NO pagina)
  const filtrados = useMemo(() => {
    if (serverPaginated) return usuarios;

    const query = dq.trim().toLowerCase();

    return usuarios
      .filter((u) => {
        if (dRol !== "todos" && u.rol !== dRol) return false;
        if (dEstado !== "todos" && (u.estado ?? "").toLowerCase() !== dEstado) return false;
        if (dSede !== "todos" && u.sede_principal !== dSede) return false;

        if (!query) return true;

        const nombre = `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase();
        return (
          (u.username ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query) ||
          (u.documento ?? "").toLowerCase().includes(query) ||
          nombre.includes(query)
        );
      })
      .sort((a, b) => a.id - b.id);
  }, [usuarios, dq, dRol, dEstado, dSede, serverPaginated]);

  const totalCount = serverPaginated ? count : filtrados.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pageItems = useMemo(() => {
    if (serverPaginated) return usuarios;
    return filtrados.slice((page - 1) * pageSize, page * pageSize);
  }, [usuarios, filtrados, page, serverPaginated]);

  const stats = useMemo(() => {
    // stats siempre basados en lo que tenemos cargado en pantalla (mantiene tu diseÃ±o)
    const base = serverPaginated ? usuarios : usuarios;

    const total = serverPaginated ? count : base.length;
    const activos = base.filter((u) => (u.estado ?? "").toLowerCase() === "activo").length;
    const bloqueados = base.filter((u) => (u.estado ?? "").toLowerCase() === "bloqueado").length;

    const admins = base.filter((u) => u.rol === "admin").length;
    const guardas = base.filter((u) => u.rol === "guarda").length;
    const aprendices = base.filter((u) => u.rol === "aprendiz").length;

    return { total, activos, bloqueados, admins, guardas, aprendices };
  }, [usuarios, count, serverPaginated]);

  function aplicarFiltrosDesdeCard(next: {
    rol?: "todos" | "admin" | "guarda" | "aprendiz";
    estado?: "todos" | "activo" | "bloqueado";
  }) {
    setQ("");
    setSedeFilter("todos");
    setRolFilter(next.rol ?? "todos");
    setEstadoFilter(next.estado ?? "todos");
    setPage(1);
  }

  function abrirEditar(u: Usuario) {
    setSelected(u);
    setRol(u.rol ?? "aprendiz");
    setEstado(u.estado ?? "activo");
    setSede(u.sede_principal ?? "");
    setPrograma(u.programa_formacion ?? "");
    setDocumento(u.documento ?? "");
    setEmail(u.email ?? "");
    setOpen(true);
  }

  async function guardarModal() {
    if (!selected) return;
    setSaving(true);

    try {
      const payload: Partial<Usuario> = {
        rol,
        estado,
        email: email.trim() ? email.trim() : undefined,
        sede_principal: sede ? sede : null,
        programa_formacion: programa.trim() ? programa.trim() : undefined,
        documento: documento.trim() ? documento.trim() : undefined,
      };

      await api.patch(`/api/usuarios/${selected.id}/`, payload);

      setOpen(false);
      setSelected(null);
      await cargar(page);
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // âš¡ inline update: rol/estado (mantengo como lo tenÃ­as, no toco estÃ©tica)
  async function inlinePatch(id: number, patch: Partial<Usuario>) {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

    try {
      await api.patch(`/api/usuarios/${id}/`, patch);
    } catch (e: any) {
      alert(safeErrorMessage(e));
      await cargar(page);
    }
  }

  function abrirCrear() {
    setOpenCrear(true);
    setCreating(false);

    setCUsername("");
    setCPassword("");
    setCFirst("");
    setCLast("");
    setCEmail("");
    setCDocumento("");
    setCRol("aprendiz");
    setCEstado("activo");
    setCSede("");
    setCPrograma("");
  }

  async function crearUsuario() {
    if (!c_username.trim()) return alert("Username es obligatorio.");
    if (!c_password.trim()) return alert("Password es obligatorio.");

    setCreating(true);
    try {
      const payload: any = {
        username: c_username.trim(),
        password: c_password.trim(),
        first_name: c_first.trim() || "",
        last_name: c_last.trim() || "",
        email: c_email.trim() || "",
        documento: c_documento.trim() || "",
        rol: c_rol,
        estado: c_estado,
        sede_principal: c_sede ? c_sede : null,
        programa_formacion: c_programa.trim() || null,
      };

      await api.post("/api/usuarios/", payload);

      setOpenCrear(false);
      setPage(1);
      await cargar(1);
      alert("âœ… Usuario creado.");
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  function abrirImportar() {
    setOpenImportar(true);
    setImportFile(null);
    setImportId("");
    setImportResumen(null);
    setImportErrores([]);
    setValidandoImport(false);
    setConfirmandoImport(false);
  }

  async function validarImportacion() {
    if (!importFile) {
      alert("Selecciona un archivo Excel antes de validar.");
      return;
    }

    setValidandoImport(true);
    try {
      const form = new FormData();
      form.append("file", importFile);

      const res = await api.post("/api/usuarios/importar-aprendices/validar/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res?.data?.data ?? res?.data ?? {};
      setImportId(data.import_id ?? "");
      setImportResumen(data.resumen ?? null);
      setImportErrores(data.errores ?? []);
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setValidandoImport(false);
    }
  }

  async function confirmarImportacion() {
    if (!importId) {
      alert("Primero valida el archivo.");
      return;
    }

    setConfirmandoImport(true);
    try {
      const res = await api.post("/api/usuarios/importar-aprendices/confirmar/", {
        import_id: importId,
      });
      const data = res?.data?.data ?? res?.data ?? {};
      const created = data.created ?? data.created_count ?? 0;
      const updated = data.updated ?? data.updated_count ?? 0;

      alert(`ImportaciÃ³n aplicada. Creados: ${created}. Actualizados: ${updated}.`);
      setOpenImportar(false);
      setPage(1);
      await cargar(1);
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setConfirmandoImport(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Admin > Usuarios"
        title="Usuarios"
        description="Gestion de cuentas, roles, estado y carga de aprendices."
        actions={
          <>
            <button
              onClick={abrirCrear}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Crear usuario
            </button>
            <button
              onClick={abrirImportar}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Cargar aprendices (Excel)
            </button>
            <button
              onClick={() => cargar(page)}
              className="rounded-xl border border-surface-border bg-surface px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Recargar
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total" value={stats.total} onClick={() => aplicarFiltrosDesdeCard({ rol: "todos", estado: "todos" })} />
            <StatCard label="Activos" value={stats.activos} tone="success" onClick={() => aplicarFiltrosDesdeCard({ estado: "activo" })} />
            <StatCard label="Bloqueados" value={stats.bloqueados} tone="danger" onClick={() => aplicarFiltrosDesdeCard({ estado: "bloqueado" })} />
            <StatCard label="Admins" value={stats.admins} tone="purple" onClick={() => aplicarFiltrosDesdeCard({ rol: "admin", estado: "todos" })} />
            <StatCard label="Guardas" value={stats.guardas} tone="info" onClick={() => aplicarFiltrosDesdeCard({ rol: "guarda", estado: "todos" })} />
            <StatCard label="Aprendices" value={stats.aprendices} tone="warning" onClick={() => aplicarFiltrosDesdeCard({ rol: "aprendiz", estado: "todos" })} />
          </>
        )}
      </div>

      <FilterBar
        footer={
          error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-700">{error}</div>
          ) : null
        }
      >
        <div className="relative w-full md:col-span-4">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">âŒ•</span>
          <input
            className="w-full rounded-xl border border-surface-border bg-surface pl-9 pr-3 py-2 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            placeholder="Buscar: username, email, documento, nombre..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 md:col-span-2"
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value as "todos" | "admin" | "guarda" | "aprendiz")}
        >
          <option value="todos">Rol: Todos</option>
          <option value="admin">Rol: admin</option>
          <option value="guarda">Rol: guarda</option>
          <option value="aprendiz">Rol: aprendiz</option>
        </select>

        <select
          className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 md:col-span-2"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as "todos" | "activo" | "bloqueado")}
        >
          <option value="todos">Estado: Todos</option>
          <option value="activo">Estado: activo</option>
          <option value="bloqueado">Estado: bloqueado</option>
        </select>

        <select
          className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 md:col-span-2"
          value={sedeFilter}
          onChange={(e) => setSedeFilter(e.target.value as "todos" | (typeof SEDES)[number])}
        >
          <option value="todos">Sede: Todas</option>
          {SEDES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setQ("");
            setRolFilter("todos");
            setEstadoFilter("todos");
            setSedeFilter("todos");
            setPage(1);
          }}
          className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:col-span-1"
        >
          Limpiar
        </button>

        <div className="flex items-center justify-end rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-zinc-600 md:col-span-1">
          {totalCount} usuarios
        </div>
      </FilterBar>

      {loadingTable ? (
        <TableSkeleton rows={Math.min(8, pageSize)} />
      ) : (
        <>
          <section className="overflow-auto rounded-3xl border border-white/80 bg-white/80 shadow-[0_10px_28px_rgba(2,6,23,0.06)]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-primary/10 text-primary">
                <tr className="text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Sede</th>
                  <th className="p-3">Programa</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {pageItems.map((u, idx) => (
                  <tr key={u.id} className={cx("transition hover:bg-primary/10", idx % 2 === 1 && "bg-zinc-50/35")}>
                    <td className="p-3">{u.id}</td>

                    <td className="p-3">
                      <div className="font-semibold text-primary">{u.username}</div>
                      {u.email ? <div className="text-zinc-500">{u.email}</div> : null}
                    </td>

                    <td className="p-3">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "-"}</td>

                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <BadgeChip tone={u.rol === "admin" ? "purple" : u.rol === "guarda" ? "info" : "success"}>{u.rol ?? "-"}</BadgeChip>
                        <select
                          className="rounded-xl border border-zinc-200 p-2 bg-white outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          value={u.rol ?? "aprendiz"}
                          onChange={(e) => inlinePatch(u.id, { rol: e.target.value })}
                          title="Cambiar rol (rapido)"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <BadgeChip tone={(u.estado ?? "").toLowerCase() === "bloqueado" ? "danger" : "success"}>{u.estado ?? "-"}</BadgeChip>
                        <select
                          className="rounded-xl border border-zinc-200 p-2 bg-white outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          value={(u.estado ?? "activo").toLowerCase()}
                          onChange={(e) => inlinePatch(u.id, { estado: e.target.value })}
                          title="Cambiar estado (rapido)"
                        >
                          <option value="activo">activo</option>
                          <option value="bloqueado">bloqueado</option>
                        </select>
                      </div>
                    </td>

                    <td className="p-3">{u.documento ?? "-"}</td>
                    <td className="p-3">{u.sede_principal ?? "-"}</td>
                    <td className="p-3">{u.programa_formacion ?? "-"}</td>

                    <td className="p-3">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}

                {pageItems.length === 0 ? (
                  <tr>
                    <td className="p-10 text-center" colSpan={9}>
                      <div className="mx-auto max-w-md rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 p-6 text-zinc-700">
                        <p className="text-base font-semibold text-zinc-900">No hay usuarios para mostrar</p>
                        <p className="mt-1 text-sm text-zinc-600">Prueba limpiando o ajustando los filtros activos.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      {/* MODAL EDITAR */}
      {selected && (
        <Modal
          open={open}
          title={`Editar usuario #${selected.id} - ${selected.username}`}
          onClose={() => setOpen(false)}
          maxWidthClassName="max-w-lg"
        >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Rol</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Estado</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={estado.toLowerCase()}
                    onChange={(e) => setEstado(e.target.value)}
                  >
                    <option value="activo">activo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Correo (email)</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="QR / documento"
                  />
                </label>

                {/* âœ… SEDE como SELECT en el MODAL (como pediste) */}
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Sede principal</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                  >
                    <option value="">(sin sede)</option>
                    {SEDES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Programa formaciÃ³n</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={programa}
                    onChange={(e) => setPrograma(e.target.value)}
                    placeholder="ADSO..."
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="border rounded-xl px-4 py-2 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>

                <button
                  disabled={saving}
                  onClick={guardarModal}
                  className="bg-primary text-white rounded-xl px-4 py-2 disabled:opacity-50 hover:bg-primary/90 shadow-sm transition"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
          </Modal>
        )}

        {/* MODAL CREAR */}
        {openCrear && (
          <Modal
            open={openCrear}
            title="Crear usuario"
            onClose={() => (!creating ? setOpenCrear(false) : null)}
            maxWidthClassName="max-w-xl"
            closeDisabled={creating}
          >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Username *</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_username}
                    onChange={(e) => setCUsername(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Password *</div>
                  <input
                    type="password"
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_password}
                    onChange={(e) => setCPassword(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Nombres</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_first}
                    onChange={(e) => setCFirst(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Apellidos</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_last}
                    onChange={(e) => setCLast(e.target.value)}
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Email</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_email}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder={emailPlaceholder}
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento (QR)</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_documento}
                    onChange={(e) => setCDocumento(e.target.value)}
                    placeholder="1012345678"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Rol</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_rol}
                    onChange={(e) => setCRol(e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Estado</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_estado}
                    onChange={(e) => setCEstado(e.target.value)}
                  >
                    <option value="activo">activo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Sede principal</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_sede}
                    onChange={(e) => setCSede(e.target.value)}
                  >
                    <option value="">(sin sede)</option>
                    {SEDES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Programa</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={c_programa}
                    onChange={(e) => setCPrograma(e.target.value)}
                    placeholder="COCINA / ADSO..."
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpenCrear(false)}
                  disabled={creating}
                  className="border rounded-xl px-4 py-2 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={crearUsuario}
                  disabled={creating}
                  className="bg-primary text-white rounded-xl px-4 py-2 disabled:opacity-50 hover:bg-primary/90 shadow-sm transition"
                >
                  {creating ? "Creando..." : "Crear usuario"}
                </button>
              </div>
          </Modal>
        )}

        <Modal
          open={openImportar}
          title="Importar aprendices desde Excel"
          onClose={() => (!validandoImport && !confirmandoImport ? setOpenImportar(false) : null)}
          maxWidthClassName="max-w-4xl"
          closeDisabled={validandoImport || confirmandoImport}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-text/80">
              Flujo obligatorio: 1) Selecciona archivo. 2) Validar. 3) Confirmar importaciÃ³n.
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <input
                type="file"
                accept=".xlsx,.xlsm,.xltx,.xltm"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              <button
                onClick={validarImportacion}
                disabled={!importFile || validandoImport || confirmandoImport}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validandoImport ? "Validando..." : "Validar archivo"}
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={!importId || confirmandoImport || validandoImport}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmandoImport ? "Confirmando..." : "Confirmar importaciÃ³n"}
              </button>
            </div>

            {importResumen && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-text/70">Total</div>
                  <div className="text-xl font-semibold text-text">{importResumen.total}</div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary">VÃ¡lidos</div>
                  <div className="text-xl font-semibold text-primary">{importResumen.validos}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xs text-rose-700">Errores</div>
                  <div className="text-xl font-semibold text-rose-800">{importResumen.errores}</div>
                </div>
              </div>
            )}

            {importErrores.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-rose-200">
                <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
                  Errores de validaciÃ³n
                </div>
                <div className="max-h-64 overflow-auto bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface text-left text-text/75">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">CÃ³digo</th>
                        <th className="px-3 py-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importErrores.map((err, idx) => (
                        <tr key={`${err.row}-${err.code}-${idx}`}>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2 font-medium text-rose-700">{err.code}</td>
                          <td className="px-3 py-2 text-text/80">
                            {err.message}
                            {err.field ? ` (campo: ${err.field})` : ""}
                            {err.fields?.length ? ` (campos: ${err.fields.join(", ")})` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
    </div>
  );
}



