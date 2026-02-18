"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { useMe } from "@/hooks/useMe";

type Usuario = {
  id: number;
  username: string;
  email?: string | null;
  rol?: "superadmin" | "admin_sede" | "aprendiz" | "guarda" | string;
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

const ROLES = ["superadmin", "admin_sede", "guarda", "aprendiz"] as const;
const ROLES_NON_SUPERADMIN = ["guarda", "aprendiz"] as const;
const SEDES = ["CEGAFE", "SANTA_CLARA", "ITEDRIS", "GASTRONOMIA"] as const;

function isAdministrativeRole(rol?: string | null) {
  return ["superadmin", "admin_sede"].includes(String(rol || ""));
}

function canDeleteByRole(actorRol?: string | null, actorSede?: string | null, target?: Usuario | null) {
  if (!target) return false;
  if (actorRol === "superadmin") return true;
  if (actorRol === "admin_sede") {
    const sameSede = String(target.sede_principal || "") === String(actorSede || "");
    const targetAllowed = ["guarda", "aprendiz"].includes(String(target.rol || ""));
    return sameSede && targetAllowed;
  }
  return false;
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
    "No se pudo completar la acción."
  );
}

function badgeBase() {
  return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
}
function badgeRol(rol?: string) {
  if (rol === "superadmin") return `${badgeBase()} bg-fuchsia-100 text-fuchsia-800`;
  if (rol === "admin_sede") return `${badgeBase()} bg-violet-100 text-violet-800`;
  if (rol === "guarda") return `${badgeBase()} bg-blue-100 text-blue-800`;
  return `${badgeBase()} bg-emerald-100 text-emerald-800`; // aprendiz
}
function badgeEstado(estado?: string) {
  if ((estado ?? "").toLowerCase() === "bloqueado") return `${badgeBase()} bg-red-100 text-red-800`;
  return `${badgeBase()} bg-emerald-100 text-emerald-800`; // activo
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
      {/* Tabla skeleton (misma “caja” que tu tabla real) */}
      <div className="overflow-auto bg-white rounded-2xl shadow-sm border">
        <table className="min-w-full text-sm">
          {/* Mantener el header real (como en tu tabla) da contexto y se ve pro */}
          <thead className="bg-emerald-50 text-emerald-900">
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
              <tr key={i} className="hover:bg-emerald-50/40 transition">
                {/* ID */}
                <td className="p-3">
                  <div className="h-4 w-10 rounded sadi-skeleton" />
                </td>

                {/* Usuario (2 líneas: username + email) */}
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

                {/* Acciones (botón) */}
                <td className="p-3">
                  <div className="h-10 w-24 rounded-xl sadi-skeleton" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación skeleton (misma caja que tu paginación real) */}
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
  const { me } = useMe();
  const canManageAdminRoles = me?.rol === "superadmin";
  const roleOptionsForActor = canManageAdminRoles ? ROLES : ROLES_NON_SUPERADMIN;
  const actorRol = me?.rol ?? null;
  const actorSede = me?.sede_principal ?? null;

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
  const [rolFilter, setRolFilter] = useState<"todos" | "superadmin" | "admin_sede" | "guarda" | "aprendiz">("todos");
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

  // modal eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);

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
        // fallback: backend sin paginación
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
    // stats siempre basados en lo que tenemos cargado en pantalla (mantiene tu diseño)
    const base = serverPaginated ? usuarios : usuarios;

    const total = serverPaginated ? count : base.length;
    const activos = base.filter((u) => (u.estado ?? "").toLowerCase() === "activo").length;
    const bloqueados = base.filter((u) => (u.estado ?? "").toLowerCase() === "bloqueado").length;

    const admins = base.filter((u) => ["superadmin", "admin_sede"].includes(String(u.rol))).length;
    const guardas = base.filter((u) => u.rol === "guarda").length;
    const aprendices = base.filter((u) => u.rol === "aprendiz").length;

    return { total, activos, bloqueados, admins, guardas, aprendices };
  }, [usuarios, count, serverPaginated]);

  function aplicarFiltrosDesdeCard(next: {
    rol?: "todos" | "superadmin" | "admin_sede" | "guarda" | "aprendiz";
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
        documento: documento.trim() ? documento.trim().replace(/\D/g, "").slice(0, 10) : undefined,
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

  function abrirEliminar(u: Usuario) {
    if (!canDeleteByRole(actorRol, actorSede, u)) {
      alert("No tienes permisos para eliminar este usuario.");
      return;
    }
    setDeleteTarget(u);
    setOpenDelete(true);
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/usuarios/${deleteTarget.id}/`);
      setOpenDelete(false);
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) {
        setOpen(false);
        setSelected(null);
      }
      await cargar(page);
      alert("✅ Usuario eliminado.");
    } catch (e: any) {
      alert(safeErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  // ⚡ inline update: rol/estado (mantengo como lo tenías, no toco estética)
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
        documento: c_documento.trim().replace(/\D/g, "").slice(0, 10) || "",
        rol: c_rol,
        estado: c_estado,
        sede_principal: c_sede ? c_sede : null,
        programa_formacion: c_programa.trim() || null,
      };

      await api.post("/api/usuarios/", payload);

      setOpenCrear(false);
      setPage(1);
      await cargar(1);
      alert("✅ Usuario creado.");
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

      alert(`Importación aplicada. Creados: ${created}. Actualizados: ${updated}.`);
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
    <div className="min-h-screen bg-transparent">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin / Usuarios</h1>
            <p className="text-sm text-slate-500">Gestión de cuentas, roles y estado del sistema.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={abrirCrear}
              className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition"
            >
              ➕ Crear usuario
            </button>

            <button
              onClick={abrirImportar}
              className="rounded-xl px-4 py-2 bg-teal-700 text-white hover:bg-teal-800 shadow-sm transition"
            >
              Cargar aprendices (Excel)
            </button>

            <button
              onClick={() => cargar(page)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 shadow-sm transition"
            >
              Recargar
            </button>
          </div>
        </div>

        {/* STATS (clickeables) */}
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
              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "todos", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Ver todos"
              >
                <div className="text-2xl">👤</div>
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-2xl font-bold text-emerald-900">{stats.total}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ estado: "activo" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar activos"
              >
                <div className="text-2xl">✅</div>
                <div className="text-sm text-gray-500">Activos</div>
                <div className="text-2xl font-bold text-emerald-700">{stats.activos}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ estado: "bloqueado" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar bloqueados"
              >
                <div className="text-2xl">⛔</div>
                <div className="text-sm text-gray-500">Bloqueados</div>
                <div className="text-2xl font-bold text-red-700">{stats.bloqueados}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "admin_sede", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar admins"
              >
                <div className="text-2xl">🛡️</div>
                <div className="text-sm text-gray-500">Admins</div>
                <div className="text-2xl font-bold text-purple-700">{stats.admins}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "guarda", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar guardas"
              >
                <div className="text-2xl">👮</div>
                <div className="text-sm text-gray-500">Guardas</div>
                <div className="text-2xl font-bold text-blue-700">{stats.guardas}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "aprendiz", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar aprendices"
              >
                <div className="text-2xl">🎓</div>
                <div className="text-sm text-gray-500">Aprendices</div>
                <div className="text-2xl font-bold text-emerald-800">{stats.aprendices}</div>
              </button>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="border rounded-xl p-2 w-full sm:w-80 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Buscar: username, email, documento, nombre..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value as any)}
          >
            <option value="todos">Rol: Todos</option>
            <option value="superadmin">Rol: superadmin</option>
            <option value="admin_sede">Rol: admin_sede</option>
            <option value="guarda">Rol: guarda</option>
            <option value="aprendiz">Rol: aprendiz</option>
          </select>

          <select
            className="border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as any)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activo">Estado: activo</option>
            <option value="bloqueado">Estado: bloqueado</option>
          </select>

          <select
            className="border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value as any)}
          >
            <option value="todos">Sede: Todas</option>
            {SEDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-600 sm:ml-auto font-medium">
            {totalCount} usuarios
          </div>
        </div>

        {error && <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded-2xl">{error}</div>}

        {/* Table */}
        {loadingTable ? (
          <TableSkeleton rows={Math.min(8, pageSize)} />
        ) : (
          <>
            <div className="overflow-auto bg-white rounded-2xl shadow-sm border">
              <table className="min-w-full text-sm">
                <thead className="bg-emerald-50 text-emerald-900">
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
                  {pageItems.map((u) => (
                    <tr key={u.id} className="hover:bg-emerald-50/40 transition">
                      <td className="p-3">{u.id}</td>

                      <td className="p-3">
                        <div className="font-semibold text-emerald-900">{u.username}</div>
                        {u.email && <div className="text-gray-500">{u.email}</div>}
                      </td>

                      <td className="p-3">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "-"}</td>

                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          <span className={badgeRol(u.rol)}>{u.rol ?? "-"}</span>
                          <select
                            className="border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            value={u.rol ?? "aprendiz"}
                            onChange={(e) => inlinePatch(u.id, { rol: e.target.value })}
                            title="Cambiar rol (rápido)"
                            disabled={!canManageAdminRoles && isAdministrativeRole(u.rol)}
                          >
                            {(canManageAdminRoles || !isAdministrativeRole(u.rol) ? roleOptionsForActor : ROLES).map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-2">
                          <span className={badgeEstado(u.estado)}>{u.estado ?? "-"}</span>
                          <select
                            className="border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            value={(u.estado ?? "activo").toLowerCase()}
                            onChange={(e) => inlinePatch(u.id, { estado: e.target.value })}
                            title="Cambiar estado (rápido)"
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => abrirEditar(u)}
                            className="rounded-xl px-3 py-2 bg-white border hover:bg-emerald-50 shadow-sm transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => abrirEliminar(u)}
                            disabled={!canDeleteByRole(actorRol, actorSede, u)}
                            className="rounded-xl px-3 py-2 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={canDeleteByRole(actorRol, actorSede, u) ? "Eliminar usuario" : "No tienes permiso para eliminar este usuario"}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {pageItems.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500" colSpan={9}>
                        No hay usuarios para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

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
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    disabled={!canManageAdminRoles && isAdministrativeRole(selected?.rol)}
                  >
                    {(canManageAdminRoles || !isAdministrativeRole(selected?.rol) ? roleOptionsForActor : ROLES).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Estado</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@sena.edu.co"
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="QR / documento"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </label>

                {/* ✅ SEDE como SELECT en el MODAL (como pediste) */}
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Sede principal</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                  <div className="text-xs text-gray-500">Programa formación</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={programa}
                    onChange={(e) => setPrograma(e.target.value)}
                    placeholder="ADSO..."
                  />
                </label>
              </div>

              {!canManageAdminRoles && isAdministrativeRole(selected?.rol) ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Solo SUPERADMIN puede editar cuentas administrativas.
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="border rounded-xl px-4 py-2 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>

                <button
                  disabled={saving || (!canManageAdminRoles && isAdministrativeRole(selected?.rol))}
                  onClick={guardarModal}
                  className="bg-emerald-600 text-white rounded-xl px-4 py-2 disabled:opacity-50 hover:bg-emerald-700 shadow-sm transition"
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
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_username}
                    onChange={(e) => setCUsername(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Password *</div>
                  <input
                    type="password"
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_password}
                    onChange={(e) => setCPassword(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Nombres</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_first}
                    onChange={(e) => setCFirst(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Apellidos</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_last}
                    onChange={(e) => setCLast(e.target.value)}
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Email</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_email}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder="usuario@sena.edu.co"
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento (QR)</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_documento}
                    onChange={(e) => setCDocumento(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="1012345678"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Rol</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_rol}
                    onChange={(e) => setCRol(e.target.value)}
                  >
                    {roleOptionsForActor.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Estado</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                  className="bg-emerald-600 text-white rounded-xl px-4 py-2 disabled:opacity-50 hover:bg-emerald-700 shadow-sm transition"
                >
                  {creating ? "Creando..." : "Crear usuario"}
                </button>
              </div>
          </Modal>
        )}

        {openDelete && deleteTarget && (
          <Modal
            open={openDelete}
            title={`Eliminar usuario #${deleteTarget.id}`}
            onClose={() => (!deleting ? setOpenDelete(false) : null)}
            maxWidthClassName="max-w-lg"
            closeDisabled={deleting}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                Esta acción eliminará el usuario de forma permanente.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div><span className="font-semibold">Usuario:</span> {deleteTarget.username}</div>
                <div><span className="font-semibold">Rol:</span> {deleteTarget.rol ?? "-"}</div>
                <div><span className="font-semibold">Sede:</span> {deleteTarget.sede_principal ?? "-"}</div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpenDelete(false)}
                  disabled={deleting}
                  className="border rounded-xl px-4 py-2 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEliminar}
                  disabled={deleting}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar usuario"}
                </button>
              </div>
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Flujo obligatorio: 1) Selecciona archivo. 2) Validar. 3) Confirmar importación.
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <input
                type="file"
                accept=".xlsx,.xlsm,.xltx,.xltm"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={validarImportacion}
                disabled={!importFile || validandoImport || confirmandoImport}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validandoImport ? "Validando..." : "Validar archivo"}
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={!importId || confirmandoImport || validandoImport}
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmandoImport ? "Confirmando..." : "Confirmar importación"}
              </button>
            </div>

            {importResumen && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="text-xl font-semibold text-slate-900">{importResumen.total}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">Válidos</div>
                  <div className="text-xl font-semibold text-emerald-800">{importResumen.validos}</div>
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
                  Errores de validación
                </div>
                <div className="max-h-64 overflow-auto bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importErrores.map((err, idx) => (
                        <tr key={`${err.row}-${err.code}-${idx}`}>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2 font-medium text-rose-700">{err.code}</td>
                          <td className="px-3 py-2 text-slate-700">
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
    </div>
  );
}
