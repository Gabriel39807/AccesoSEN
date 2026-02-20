"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatFieldLabel, normalizeApiErrors, toErrorMessage } from "@/lib/errors";
import { sanitizeDigits, validateDocument6to10 } from "@/lib/validators";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { useMe } from "@/hooks/useMe";
import { useSedes } from "@/hooks/useSedes";

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

type NoticeTone = "success" | "error" | "info";

const ROLES = ["superadmin", "admin_sede", "guarda", "aprendiz"] as const;
const ROLES_NON_SUPERADMIN = ["guarda", "aprendiz"] as const;

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

function isValidUsername(username: string) {
  return /^[A-Za-z0-9_@.+-]+$/.test(username);
}

function isValidEmail(email: string) {
  const value = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasPasswordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("La contrasena debe tener minimo 8 caracteres.");
  if (password.length > 20) errors.push("La contrasena debe tener maximo 20 caracteres.");
  if (!/[A-Z]/.test(password)) errors.push("La contrasena debe incluir al menos 1 mayuscula.");
  if (!/[a-z]/.test(password)) errors.push("La contrasena debe incluir al menos 1 minuscula.");
  if (!/[0-9]/.test(password)) errors.push("La contrasena debe incluir al menos 1 numero.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("La contrasena debe incluir al menos 1 caracter especial.");
  return errors;
}

function addFormError(target: string[], message: string) {
  const clean = message.trim();
  if (!clean) return;
  if (!target.includes(clean)) target.push(clean);
}

function addFieldError(target: Record<string, string[]>, field: string, message: string) {
  const key = String(field || "").trim();
  const clean = String(message || "").trim();
  if (!key || !clean) return;
  if (!target[key]) target[key] = [];
  if (!target[key].includes(clean)) target[key].push(clean);
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
      {/* Tabla skeleton (misma caja que tu tabla real) */}
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

                {/* Usuario (2 lineas: username + email) */}
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

                {/* Acciones (boton) */}
                <td className="p-3">
                  <div className="h-10 w-24 rounded-xl sadi-skeleton" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginacion skeleton (misma caja que tu paginacion real) */}
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
  const { sedes } = useSedes();
  const canManageAdminRoles = me?.rol === "superadmin";
  const roleOptionsForActor = canManageAdminRoles ? ROLES : ROLES_NON_SUPERADMIN;
  const actorRol = me?.rol ?? null;
  const actorSede = me?.sede_principal ?? null;
  const isScopedAdmin = actorRol === "admin_sede";

  // data
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [count, setCount] = useState<number>(0);
  const [serverPaginated, setServerPaginated] = useState<boolean>(false);

  // loading/error
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  // UI controls
  const [q, setQ] = useState("");
  const [rolFilter, setRolFilter] = useState<"todos" | "superadmin" | "admin_sede" | "guarda" | "aprendiz">("todos");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activo" | "bloqueado">("todos");
  const [sedeFilter, setSedeFilter] = useState("todos");

  // debounce
  const dq = useDebounced(q, 450);
  const dRol = useDebounced(rolFilter, 350);
  const dEstado = useDebounced(estadoFilter, 350);
  const dSede = useDebounced(sedeFilter, 350);
  const sedeCodes = useMemo(() => sedes.map((s) => s.code), [sedes]);

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
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string[]>>({});
  const [createFormErrors, setCreateFormErrors] = useState<string[]>([]);
  const createInputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  // modal importar aprendices (excel 2 fases)
  const [openImportar, setOpenImportar] = useState(false);
  const [validandoImport, setValidandoImport] = useState(false);
  const [confirmandoImport, setConfirmandoImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string>("");
  const [importResumen, setImportResumen] = useState<{ validos: number; errores: number; total: number } | null>(null);
  const [importErrores, setImportErrores] = useState<ImportValidationError[]>([]);

  const requestIdRef = useRef(0);

  function setCreateInputRef(field: string) {
    return (el: HTMLInputElement | HTMLSelectElement | null) => {
      createInputRefs.current[field] = el;
    };
  }

  function clearCreateFieldError(field: string) {
    setCreateFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function clearCreateErrorsOnChange(field: string) {
    clearCreateFieldError(field);
    if (createFormErrors.length) setCreateFormErrors([]);
  }

  function focusFirstCreateError(fieldErrors: Record<string, string[]>) {
    const firstField = Object.keys(fieldErrors)[0];
    if (!firstField) return;
    window.setTimeout(() => createInputRefs.current[firstField]?.focus(), 0);
  }

  function validateCreateUserForm() {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    const username = c_username.trim();
    const password = c_password.trim();
    const firstName = c_first.trim();
    const lastName = c_last.trim();
    const email = c_email.trim().toLowerCase();
    const documento = sanitizeDigits(c_documento).slice(0, 10);
    const role = c_rol.trim();
    const state = c_estado.trim();
    const sede = (isScopedAdmin ? actorSede || c_sede : c_sede).trim();
    const programa = c_programa.trim();

    if (!username) addFieldError(fieldErrors, "username", "El campo nombre de usuario es obligatorio.");
    else if (!isValidUsername(username)) {
      addFieldError(fieldErrors, "username", "Solo se permiten letras, numeros y los simbolos _ @ . + -");
    } else if (username.length > 150) {
      addFieldError(fieldErrors, "username", "El nombre de usuario no puede superar 150 caracteres.");
    }

    if (!password) addFieldError(fieldErrors, "password", "El campo contrasena es obligatorio.");
    for (const passwordError of hasPasswordPolicyErrors(password)) {
      addFieldError(fieldErrors, "password", passwordError);
    }

    if (!firstName) addFieldError(fieldErrors, "first_name", "El campo nombres es obligatorio.");
    if (!lastName) addFieldError(fieldErrors, "last_name", "El campo apellidos es obligatorio.");

    if (!email) {
      addFieldError(fieldErrors, "email", "El campo correo es obligatorio.");
    } else if (!isValidEmail(email)) {
      addFieldError(fieldErrors, "email", "El correo no tiene un formato valido.");
    }

    if (!documento) {
      addFieldError(fieldErrors, "documento", "El campo documento es obligatorio.");
    } else {
      const docError = validateDocument6to10(documento);
      if (docError) addFieldError(fieldErrors, "documento", docError);
    }

    if (!role) {
      addFieldError(fieldErrors, "rol", "El campo rol es obligatorio.");
    } else if (!roleOptionsForActor.includes(role as any)) {
      addFieldError(fieldErrors, "rol", "El rol seleccionado no es valido para tu perfil.");
    }

    if (!state) {
      addFieldError(fieldErrors, "estado", "El campo estado es obligatorio.");
    } else if (!["activo", "bloqueado"].includes(state)) {
      addFieldError(fieldErrors, "estado", "El estado seleccionado no es valido.");
    }

    if (!sede) {
      addFieldError(fieldErrors, "sede_principal", "El campo sede principal es obligatorio.");
    } else if (!sedeCodes.includes(sede)) {
      addFieldError(fieldErrors, "sede_principal", "La sede seleccionada no es valida.");
    }

    if (role === "aprendiz" && !programa) {
      addFieldError(fieldErrors, "programa_formacion", "El campo programa es obligatorio para aprendices.");
    }

    if (!canManageAdminRoles && isAdministrativeRole(role)) {
      addFormError(formErrors, "No tienes permisos para crear usuarios administrativos.");
    }

    return { fieldErrors, formErrors };
  }

  const createErrorSummary = useMemo(() => {
    const summary = [...createFormErrors];
    for (const [field, messages] of Object.entries(createFieldErrors)) {
      for (const message of messages) {
        addFormError(summary, `${formatFieldLabel(field)}: ${message}`);
      }
    }
    return summary;
  }, [createFieldErrors, createFormErrors]);

  function showNotice(tone: NoticeTone, text: string) {
    setNotice({ tone, text });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      if (isScopedAdmin) {
        if (actorSede) params.sede_id = actorSede;
      } else if (dSede !== "todos") {
        params.sede_id = dSede;
      }

      const res = await api.get<Paginated<Usuario> | Usuario[]>("/api/usuarios/", { params });
      const payload: any = res.data;

      if (rid !== requestIdRef.current) return;

      if (Array.isArray(payload)) {
        // fallback: backend sin paginacion
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
      setError(toErrorMessage(e, "No se pudo cargar la lista de usuarios."));
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

  useEffect(() => {
    if (!isScopedAdmin) return;
    if (!actorSede) return;
    setSedeFilter(actorSede);
  }, [isScopedAdmin, actorSede]);

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
    // stats siempre basados en lo que tenemos cargado en pantalla (mantiene tu diseno)
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
    if (isScopedAdmin && actorSede) setSedeFilter(actorSede);
    else setSedeFilter("todos");
    setRolFilter(next.rol ?? "todos");
    setEstadoFilter(next.estado ?? "todos");
    setPage(1);
  }

  function abrirEditar(u: Usuario) {
    setSelected(u);
    setRol(u.rol ?? "aprendiz");
    setEstado(u.estado ?? "activo");
    setSede(isScopedAdmin && actorSede ? actorSede : u.sede_principal ?? "");
    setPrograma(u.programa_formacion ?? "");
    setDocumento(u.documento ?? "");
    setEmail(u.email ?? "");
    setOpen(true);
  }

  async function guardarModal() {
    if (!selected) return;
    setSaving(true);

    try {
      const sanitizedDocumento = sanitizeDigits(documento).slice(0, 10);
      if (sanitizedDocumento) {
        const docError = validateDocument6to10(sanitizedDocumento);
        if (docError) {
          showNotice("error", docError);
          return;
        }
      }

      const payload: Partial<Usuario> = {
        rol,
        estado,
        email: email.trim() ? email.trim() : undefined,
        sede_principal: sede ? sede : null,
        programa_formacion: programa.trim() ? programa.trim() : undefined,
        documento: sanitizedDocumento || undefined,
      };

      await api.patch(`/api/usuarios/${selected.id}/`, payload);

      setOpen(false);
      setSelected(null);
      await cargar(page);
      showNotice("success", "Cambios guardados correctamente.");
    } catch (e: any) {
      showNotice("error", toErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function abrirEliminar(u: Usuario) {
    if (!canDeleteByRole(actorRol, actorSede, u)) {
      showNotice("error", "No tienes permisos para eliminar este usuario.");
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
      showNotice("success", "Usuario eliminado correctamente.");
    } catch (e: any) {
      showNotice("error", toErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  // inline update: rol/estado (mantengo la estetica actual)
  async function inlinePatch(id: number, patch: Partial<Usuario>) {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

    try {
      await api.patch(`/api/usuarios/${id}/`, patch);
      showNotice("success", "Usuario actualizado.");
    } catch (e: any) {
      showNotice("error", toErrorMessage(e));
      await cargar(page);
    }
  }

  function abrirCrear() {
    setOpenCrear(true);
    setCreating(false);
    setCreateFieldErrors({});
    setCreateFormErrors([]);

    setCUsername("");
    setCPassword("");
    setCFirst("");
    setCLast("");
    setCEmail("");
    setCDocumento("");
    setCRol("aprendiz");
    setCEstado("activo");
    setCSede(isScopedAdmin && actorSede ? actorSede : "");
    setCPrograma("");
  }

  async function crearUsuario() {
    setCreateFieldErrors({});
    setCreateFormErrors([]);

    const localValidation = validateCreateUserForm();
    if (Object.keys(localValidation.fieldErrors).length > 0 || localValidation.formErrors.length > 0) {
      setCreateFieldErrors(localValidation.fieldErrors);
      setCreateFormErrors(localValidation.formErrors);
      focusFirstCreateError(localValidation.fieldErrors);
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        username: c_username.trim(),
        password: c_password.trim(),
        first_name: c_first.trim() || "",
        last_name: c_last.trim() || "",
        email: c_email.trim().toLowerCase() || "",
        documento: sanitizeDigits(c_documento).slice(0, 10) || "",
        rol: c_rol,
        estado: c_estado,
        sede_principal: isScopedAdmin ? actorSede || null : c_sede ? c_sede : null,
        programa_formacion: c_programa.trim() || null,
      };

      await api.post("/api/usuarios/", payload);

      setOpenCrear(false);
      setPage(1);
      await cargar(1);
      showNotice("success", "Usuario creado correctamente.");
    } catch (e: any) {
      const normalized = normalizeApiErrors(e, "No se pudo crear el usuario.");
      if (Object.keys(normalized.fieldErrors).length > 0) {
        setCreateFieldErrors(normalized.fieldErrors);
        focusFirstCreateError(normalized.fieldErrors);
      }
      if (normalized.formErrors.length > 0) {
        setCreateFormErrors(normalized.formErrors);
      }

      const firstGeneral =
        normalized.formErrors[0] ||
        Object.entries(normalized.fieldErrors)
          .flatMap(([field, messages]) => messages.map((msg) => `${formatFieldLabel(field)}: ${msg}`))[0] ||
        "No se pudo crear el usuario.";
      showNotice("error", firstGeneral);
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
      showNotice("info", "Selecciona un archivo Excel antes de validar.");
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
      showNotice("success", "Archivo validado. Revisa el resumen y confirma la importacion.");
    } catch (e: any) {
      showNotice("error", toErrorMessage(e));
    } finally {
      setValidandoImport(false);
    }
  }

  async function confirmarImportacion() {
    if (!importId) {
      showNotice("info", "Primero valida el archivo.");
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

      showNotice("success", `Importacion aplicada. Creados: ${created}. Actualizados: ${updated}.`);
      setOpenImportar(false);
      setPage(1);
      await cargar(1);
    } catch (e: any) {
      showNotice("error", toErrorMessage(e));
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
            <p className="text-sm text-slate-500">Gestion de cuentas, roles y estado del sistema.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={abrirCrear}
              className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition"
            >
              + Crear usuario
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

        {notice ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : notice.tone === "info"
                  ? "border-sky-200 bg-sky-50 text-sky-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-lg border border-current/20 px-2 py-0.5 text-xs hover:bg-white/60"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : null}

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
                <div className="text-2xl">USR</div>
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-2xl font-bold text-emerald-900">{stats.total}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ estado: "activo" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar activos"
              >
                <div className="text-2xl">OK</div>
                <div className="text-sm text-gray-500">Activos</div>
                <div className="text-2xl font-bold text-emerald-700">{stats.activos}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ estado: "bloqueado" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar bloqueados"
              >
                <div className="text-2xl">BLQ</div>
                <div className="text-sm text-gray-500">Bloqueados</div>
                <div className="text-2xl font-bold text-red-700">{stats.bloqueados}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "admin_sede", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar admins"
              >
                <div className="text-2xl">ADM</div>
                <div className="text-sm text-gray-500">Admins</div>
                <div className="text-2xl font-bold text-purple-700">{stats.admins}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "guarda", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar guardas"
              >
                <div className="text-2xl">GRD</div>
                <div className="text-sm text-gray-500">Guardas</div>
                <div className="text-2xl font-bold text-blue-700">{stats.guardas}</div>
              </button>

              <button
                onClick={() => aplicarFiltrosDesdeCard({ rol: "aprendiz", estado: "todos" })}
                className="text-left bg-white rounded-2xl shadow-sm border p-4 hover:-translate-y-0.5 hover:shadow transition"
                title="Filtrar aprendices"
              >
                <div className="text-2xl">APR</div>
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
            onChange={(e) => setSedeFilter(e.target.value)}
            disabled={isScopedAdmin}
          >
            {!isScopedAdmin ? <option value="todos">Sede: Todas</option> : null}
            {sedes.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}
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
                            title="Cambiar rol (rapido)"
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
                    placeholder="usuario@dominio.com"
                  />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento</div>
                  <input
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={documento}
                    onChange={(e) => setDocumento(sanitizeDigits(e.target.value).slice(0, 10))}
                    placeholder="QR / documento"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                  />
                </label>

                {/* SEDE como SELECT en el MODAL */}
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Sede principal</div>
                  <select
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    disabled={isScopedAdmin}
                  >
                    {isScopedAdmin ? (
                      <option value={actorSede ?? ""}>{actorSede ?? "Sin sede"}</option>
                    ) : (
                      <>
                        <option value="">(sin sede)</option>
                        {sedes.map((s) => (
                          <option key={s.id} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Programa formacion</div>
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
              {createErrorSummary.length > 0 ? (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert" aria-live="polite">
                  <p className="font-semibold">No se pudo crear el usuario. Corrige lo siguiente:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {createErrorSummary.map((msg, idx) => (
                      <li key={`${msg}-${idx}`}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Username *</div>
                  <input
                    ref={setCreateInputRef("username")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.username?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_username}
                    onChange={(e) => {
                      setCUsername(e.target.value.trimStart());
                      clearCreateErrorsOnChange("username");
                    }}
                    aria-invalid={createFieldErrors.username?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.username?.length ? "create-username-error" : undefined}
                    placeholder="Ej: aprendiz1 o gabriel_pico_8"
                  />
                  <div className="text-[11px] text-slate-500">Solo letras, numeros y simbolos _ @ . + -</div>
                  {createFieldErrors.username?.length ? (
                    <div id="create-username-error" className="text-xs text-rose-700">
                      {createFieldErrors.username[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Password *</div>
                  <input
                    ref={setCreateInputRef("password")}
                    type="password"
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.password?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_password}
                    onChange={(e) => {
                      setCPassword(e.target.value);
                      clearCreateErrorsOnChange("password");
                    }}
                    maxLength={20}
                    aria-invalid={createFieldErrors.password?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.password?.length ? "create-password-error" : undefined}
                  />
                  {createFieldErrors.password?.length ? (
                    <ul id="create-password-error" className="text-xs text-rose-700 list-disc pl-5">
                      {createFieldErrors.password.map((msg, idx) => (
                        <li key={`${msg}-${idx}`}>{msg}</li>
                      ))}
                    </ul>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Nombres *</div>
                  <input
                    ref={setCreateInputRef("first_name")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.first_name?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_first}
                    onChange={(e) => {
                      setCFirst(e.target.value);
                      clearCreateErrorsOnChange("first_name");
                    }}
                    aria-invalid={createFieldErrors.first_name?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.first_name?.length ? "create-first-name-error" : undefined}
                  />
                  {createFieldErrors.first_name?.length ? (
                    <div id="create-first-name-error" className="text-xs text-rose-700">
                      {createFieldErrors.first_name[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Apellidos *</div>
                  <input
                    ref={setCreateInputRef("last_name")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.last_name?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_last}
                    onChange={(e) => {
                      setCLast(e.target.value);
                      clearCreateErrorsOnChange("last_name");
                    }}
                    aria-invalid={createFieldErrors.last_name?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.last_name?.length ? "create-last-name-error" : undefined}
                  />
                  {createFieldErrors.last_name?.length ? (
                    <div id="create-last-name-error" className="text-xs text-rose-700">
                      {createFieldErrors.last_name[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Email *</div>
                  <input
                    ref={setCreateInputRef("email")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.email?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_email}
                    onChange={(e) => {
                      setCEmail(e.target.value);
                      clearCreateErrorsOnChange("email");
                    }}
                    placeholder="usuario@dominio.com"
                    aria-invalid={createFieldErrors.email?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.email?.length ? "create-email-error" : undefined}
                  />
                  {createFieldErrors.email?.length ? (
                    <div id="create-email-error" className="text-xs text-rose-700">
                      {createFieldErrors.email[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-gray-500">Documento (QR) *</div>
                  <input
                    ref={setCreateInputRef("documento")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.documento?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_documento}
                    onChange={(e) => {
                      setCDocumento(sanitizeDigits(e.target.value).slice(0, 10));
                      clearCreateErrorsOnChange("documento");
                    }}
                    placeholder="1012345678"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    aria-invalid={createFieldErrors.documento?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.documento?.length ? "create-documento-error" : undefined}
                  />
                  {createFieldErrors.documento?.length ? (
                    <div id="create-documento-error" className="text-xs text-rose-700">
                      {createFieldErrors.documento[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Rol *</div>
                  <select
                    ref={setCreateInputRef("rol")}
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_rol}
                    onChange={(e) => {
                      setCRol(e.target.value);
                      clearCreateErrorsOnChange("rol");
                    }}
                    aria-invalid={createFieldErrors.rol?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.rol?.length ? "create-rol-error" : undefined}
                  >
                    {roleOptionsForActor.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {createFieldErrors.rol?.length ? (
                    <div id="create-rol-error" className="text-xs text-rose-700">
                      {createFieldErrors.rol[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Estado *</div>
                  <select
                    ref={setCreateInputRef("estado")}
                    className="w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={c_estado}
                    onChange={(e) => {
                      setCEstado(e.target.value);
                      clearCreateErrorsOnChange("estado");
                    }}
                    aria-invalid={createFieldErrors.estado?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.estado?.length ? "create-estado-error" : undefined}
                  >
                    <option value="activo">activo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                  {createFieldErrors.estado?.length ? (
                    <div id="create-estado-error" className="text-xs text-rose-700">
                      {createFieldErrors.estado[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Sede principal *</div>
                  <select
                    ref={setCreateInputRef("sede_principal")}
                    className={`w-full border rounded-xl p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.sede_principal?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_sede}
                    onChange={(e) => {
                      setCSede(e.target.value);
                      clearCreateErrorsOnChange("sede_principal");
                    }}
                    disabled={isScopedAdmin}
                    aria-invalid={createFieldErrors.sede_principal?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.sede_principal?.length ? "create-sede-error" : undefined}
                  >
                    {isScopedAdmin ? (
                      <option value={actorSede ?? ""}>{actorSede ?? "Sin sede"}</option>
                    ) : (
                      <>
                        <option value="">(sin sede)</option>
                        {sedes.map((s) => (
                          <option key={s.id} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {createFieldErrors.sede_principal?.length ? (
                    <div id="create-sede-error" className="text-xs text-rose-700">
                      {createFieldErrors.sede_principal[0]}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-gray-500">Programa {c_rol === "aprendiz" ? "*" : ""}</div>
                  <input
                    ref={setCreateInputRef("programa_formacion")}
                    className={`w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                      createFieldErrors.programa_formacion?.length ? "border-rose-300 bg-rose-50/40" : ""
                    }`}
                    value={c_programa}
                    onChange={(e) => {
                      setCPrograma(e.target.value);
                      clearCreateErrorsOnChange("programa_formacion");
                    }}
                    placeholder="COCINA / ADSO..."
                    aria-invalid={createFieldErrors.programa_formacion?.length ? "true" : "false"}
                    aria-describedby={createFieldErrors.programa_formacion?.length ? "create-programa-error" : undefined}
                  />
                  {createFieldErrors.programa_formacion?.length ? (
                    <div id="create-programa-error" className="text-xs text-rose-700">
                      {createFieldErrors.programa_formacion[0]}
                    </div>
                  ) : null}
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
                Esta accion eliminara el usuario de forma permanente.
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
              Flujo obligatorio: 1) Selecciona archivo. 2) Validar. 3) Confirmar importacion.
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
                {confirmandoImport ? "Confirmando..." : "Confirmar importacion"}
              </button>
            </div>

            {importResumen && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="text-xl font-semibold text-slate-900">{importResumen.total}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">Validos</div>
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
                  Errores de validacion
                </div>
                <div className="max-h-64 overflow-auto bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Codigo</th>
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


