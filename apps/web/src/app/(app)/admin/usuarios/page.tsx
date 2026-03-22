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
import Modal from "@/components/ui/Modal";
import FormBanner from "@/components/feedback/FormBanner";
import FieldError from "@/components/feedback/FieldError";
import InlineNotice from "@/components/feedback/InlineNotice";
import Pagination from "@/components/ui/Pagination";
import { useSedes } from "@/hooks/useSedes";
import { useFormFeedback } from "@/hooks/useFormFeedback";
import { useInstitution } from "@/context/institution-context";
import { parseApiError as parseSharedApiError } from "@/lib/apiError";

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
  documento?: string | null;
};

type ImportPreviewRow = {
  source_row: number;
  first_name: string;
  last_name: string;
  documento: string;
  telefono: string;
  email: string;
  jornada: string;
  programa_formacion: string;
  sede_principal: string | null;
  username_sugerido: string;
};

type ImportRowResult = {
  row: number;
  documento: string;
  status: "created" | "skipped" | "failed";
  code?: string | null;
  field?: string | null;
  reason: string;
  username_asignado?: string | null;
  existing_nombre?: string | null;
  existing_sede?: string | null;
};

type BannerState = {
  type: "error" | "success" | "warning" | "info";
  message: string;
};

type ParsedApiError = {
  fieldErrors?: Record<string, string>;
  bannerMessage?: string;
};

const ROLES = ["admin", "guarda", "aprendiz"] as const;

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

function parseImportApiError(e: any): ParsedApiError {
  const shared = parseSharedApiError(e);
  const status = shared.status;
  const code = String(shared.code || "").toUpperCase();
  if (status === 403) {
    return { bannerMessage: "No tienes permisos para importar aprendices.", fieldErrors: shared.fieldErrors };
  }
  if (!e?.response) {
    return { bannerMessage: "No se pudo conectar. Reintenta.", fieldErrors: shared.fieldErrors };
  }
  if (status === 409 && code === "DOCUMENT_EXISTS") {
    return { bannerMessage: "Se encontraron documentos que ya existen en el sistema.", fieldErrors: shared.fieldErrors };
  }
  return { bannerMessage: shared.message, fieldErrors: shared.fieldErrors };
}

function parseRowErrors(payload: any): ImportRowResult[] {
  const rows = Array.isArray(payload?.row_results) ? payload.row_results : [];
  return rows.map((item: any) => ({
    row: Number(item?.row || 0),
    documento: String(item?.documento || ""),
    status: item?.status === "created" || item?.status === "skipped" || item?.status === "failed" ? item.status : "failed",
    code: item?.code ? String(item.code) : null,
    field: item?.field ? String(item.field) : null,
    reason: String(item?.reason || "No se pudo procesar la fila."),
    username_asignado: item?.username_asignado ? String(item.username_asignado) : null,
    existing_nombre: item?.existing_nombre ? String(item.existing_nombre) : null,
    existing_sede: item?.existing_sede ? String(item.existing_sede) : null,
  }));
}

function buildCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const escaped = text.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function downloadTextFile(content: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatSkeleton() {
  return <div className="command-noir-metric h-[132px] animate-pulse" />;
}

function FilterSkeleton() {
  return (
    <section className="sadi-card-strong rounded-[1.75rem] p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-4" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-2" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-1" />
        <div className="sadi-skeleton h-11 rounded-xl md:col-span-1" />
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">{value.toLocaleString("es-CO")}</p>
        </div>
        <span className="command-noir-chip" data-tone={tone}>{detail}</span>
      </div>
    </>
  );

  if (onClick) {
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

  return (
    <div className="command-noir-metric text-left">
      {content}
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <AdminTableSkeleton
      rows={rows}
      columns={[
        { label: "ID", widthClass: "w-14", variant: "text" },
        { label: "Usuario", widthClass: "w-64", variant: "stack" },
        { label: "Nombre", widthClass: "w-52", variant: "text" },
        { label: "Rol", widthClass: "w-44", variant: "pillStack" },
        { label: "Estado", widthClass: "w-44", variant: "pillStack" },
        { label: "Documento", widthClass: "w-40", variant: "text" },
        { label: "Sede", widthClass: "w-36", variant: "text" },
        { label: "Programa", widthClass: "w-44", variant: "text" },
        { label: "Acciones", widthClass: "w-32", align: "right", variant: "button" },
      ]}
    />
  );
}

export default function AdminUsuariosPage() {
  const { sedes } = useSedes();
  const { emailPlaceholder } = useInstitution();
  const sedesByCode = useMemo(() => new Map(sedes.map((item) => [item.code, item.name])), [sedes]);

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
  const [sedeFilter, setSedeFilter] = useState<string>("todos");

  // debounce
  const dq = useDebounced(q, 450);
  const dRol = useDebounced(rolFilter, 350);
  const dEstado = useDebounced(estadoFilter, 350);
  const dSede = useDebounced(sedeFilter, 350);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // modal editar
  const [open, setOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
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
  const [pageBanner, setPageBanner] = useState<BannerState | null>(null);

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
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [rowRetryPatch, setRowRetryPatch] = useState<Record<number, Partial<Usuario>>>({});

  // modal importar aprendices (excel 2 fases)
  const [openImportar, setOpenImportar] = useState(false);
  const [importStage, setImportStage] = useState<"parsing" | "ready" | "importing" | "done">("parsing");
  const [validandoImport, setValidandoImport] = useState(false);
  const [confirmandoImport, setConfirmandoImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string>("");
  const [importResumen, setImportResumen] = useState<{ validos: number; errores: number; total: number; duplicados_archivo?: number } | null>(null);
  const [importErrores, setImportErrores] = useState<ImportValidationError[]>([]);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importRowNumbers, setImportRowNumbers] = useState<number[]>([]);
  const [importRowResults, setImportRowResults] = useState<ImportRowResult[]>([]);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });
  const [duplicatesInFile, setDuplicatesInFile] = useState<ImportValidationError[]>([]);
  const [allowSkipFileDuplicates, setAllowSkipFileDuplicates] = useState(false);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [hideConflictSummary, setHideConflictSummary] = useState(false);

  const editFeedback = useFormFeedback();
  const createFeedback = useFormFeedback();
  const importFeedback = useFormFeedback();

  const editBanner = editFeedback.banner;
  const setEditBanner = editFeedback.setBanner;
  const editFieldErrors = editFeedback.fieldErrors;
  const setEditFieldErrors = editFeedback.setFieldErrors;
  const clearEditFieldError = editFeedback.clearFieldError;
  const clearAllEditFieldErrors = editFeedback.clearAllFieldErrors;
  const clearEditBanner = editFeedback.clearBanner;
  const setEditFromApiError = editFeedback.setFromApiError;
  const focusFirstEditError = editFeedback.focusFirstError;

  const createBanner = createFeedback.banner;
  const setCreateBanner = createFeedback.setBanner;
  const createFieldErrors = createFeedback.fieldErrors;
  const setCreateFieldErrors = createFeedback.setFieldErrors;
  const clearCreateFieldError = createFeedback.clearFieldError;
  const clearAllCreateFieldErrors = createFeedback.clearAllFieldErrors;
  const clearCreateBanner = createFeedback.clearBanner;
  const setCreateFromApiError = createFeedback.setFromApiError;
  const focusFirstCreateError = createFeedback.focusFirstError;

  const importBanner = importFeedback.banner;
  const setImportBanner = importFeedback.setBanner;

  const requestIdRef = useRef(0);
  const createUsernameRef = useRef<HTMLInputElement | null>(null);
  const createPasswordRef = useRef<HTMLInputElement | null>(null);
  const editRolRef = useRef<HTMLSelectElement | null>(null);
  const editEstadoRef = useRef<HTMLSelectElement | null>(null);

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
      setError(parseSharedApiError(e).message);
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
  }, [dq, dRol, dEstado, dSede, pageSize]);

  // recargar al cambiar page
  useEffect(() => {
    cargar(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!openCrear) return;
    if (createFieldErrors.username) {
      createUsernameRef.current?.focus();
      return;
    }
    if (createFieldErrors.password) {
      createPasswordRef.current?.focus();
    }
  }, [createFieldErrors, openCrear]);

  useEffect(() => {
    if (!pageBanner) return;
    const timeout = setTimeout(() => setPageBanner(null), 4000);
    return () => clearTimeout(timeout);
  }, [pageBanner]);

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
  const hasFilters =
    q.trim().length > 0 ||
    rolFilter !== "todos" ||
    estadoFilter !== "todos" ||
    sedeFilter !== "todos";

  const pageItems = useMemo(() => {
    if (serverPaginated) return usuarios;
    return filtrados.slice((page - 1) * pageSize, page * pageSize);
  }, [usuarios, filtrados, page, pageSize, serverPaginated]);

  const stats = useMemo(() => {
    // stats siempre basados en lo que tenemos cargado en pantalla (mantiene tu diseño)
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
    setEditBanner(null);
    setEditFieldErrors({});
    setOpen(true);
  }

  async function guardarModal() {
    if (!selected) return;
    const nextFieldErrors: Record<string, string> = {};
    if (!rol.trim()) nextFieldErrors.rol = "Rol es obligatorio.";
    if (!estado.trim()) nextFieldErrors.estado = "Estado es obligatorio.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setEditFieldErrors(nextFieldErrors);
      setEditBanner({
        type: "error",
        message: "Revisa los campos obligatorios.",
      });
      focusFirstEditError({
        rol: editRolRef,
        estado: editEstadoRef,
      });
      return;
    }

    setEditSaving(true);
    clearEditBanner();
    clearAllEditFieldErrors();

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
      setPageBanner({
        type: "success",
        message: "Usuario actualizado correctamente.",
      });
    } catch (e: any) {
      const parsed = setEditFromApiError(e, "No se pudieron guardar los cambios.");
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        focusFirstEditError({
          rol: editRolRef,
          estado: editEstadoRef,
        });
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function inlinePatch(id: number, patch: Partial<Usuario>) {
    const current = usuarios.find((u) => u.id === id);
    if (!current) return;

    const previousValues: Partial<Usuario> = {};
    (Object.keys(patch) as Array<keyof Usuario>).forEach((key) => {
      (previousValues as any)[key] = current[key];
    });

    setRowSaving((prev) => ({ ...prev, [id]: true }));
    setRowError((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRowRetryPatch((prev) => ({ ...prev, [id]: patch }));
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

    try {
      await api.patch(`/api/usuarios/${id}/`, patch);
      setRowSaving((prev) => ({ ...prev, [id]: false }));
      setRowError((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e: any) {
      const parsed = parseSharedApiError(e);
      const inlineMessage =
        parsed.message ||
        Object.values(parsed.fieldErrors ?? {})[0] ||
        "Intenta nuevamente.";
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...previousValues } : u)));
      setRowSaving((prev) => ({ ...prev, [id]: false }));
      setRowError((prev) => ({ ...prev, [id]: inlineMessage }));
    }
  }

  function abrirCrear() {
    setOpenCrear(true);
    setCreating(false);
    setCreateBanner(null);
    setCreateFieldErrors({});

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
    const nextFieldErrors: Record<string, string> = {};
    if (!c_username.trim()) nextFieldErrors.username = "Username es obligatorio.";
    if (!c_password.trim()) nextFieldErrors.password = "Password es obligatorio.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setCreateFieldErrors(nextFieldErrors);
      setCreateBanner({
        type: "error",
        message: "Revisa los campos obligatorios para continuar.",
      });
      focusFirstCreateError({
        username: createUsernameRef,
        password: createPasswordRef,
      });
      return;
    }

    clearAllCreateFieldErrors();
    clearCreateBanner();
    setPageBanner(null);
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
      setPageBanner({
        type: "success",
        message: "Usuario creado correctamente.",
      });
    } catch (e: any) {
      const parsed = setCreateFromApiError(e, "No se pudo crear el usuario.");
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        focusFirstCreateError({
          username: createUsernameRef,
          password: createPasswordRef,
        });
      }
    } finally {
      setCreating(false);
    }
  }

  function abrirImportar() {
    setOpenImportar(true);
    setImportStage("parsing");
    setImportBanner(null);
    setImportFile(null);
    setImportId("");
    setImportResumen(null);
    setImportErrores([]);
    setImportPreviewRows([]);
    setImportRowNumbers([]);
    setImportRowResults([]);
    setImportProgress({ processed: 0, total: 0 });
    setDuplicatesInFile([]);
    setAllowSkipFileDuplicates(false);
    setShowConflictsModal(false);
    setHideConflictSummary(false);
    setValidandoImport(false);
    setConfirmandoImport(false);
  }

  function mergeImportRowResults(existing: ImportRowResult[], incoming: ImportRowResult[]) {
    const map = new Map<number, ImportRowResult>();
    for (const row of existing) map.set(row.row, row);
    for (const row of incoming) map.set(row.row, row);
    return Array.from(map.values()).sort((a, b) => a.row - b.row);
  }

  function downloadImportErrorsCsv() {
    const validationRows = importErrores.map((err) => ({
      tipo: "validacion",
      fila: err.row,
      documento: err.documento ?? "",
      campo: err.field ?? (err.fields?.join("|") ?? ""),
      codigo: err.code,
      mensaje: err.message,
    }));
    const resultRows = importRowResults
      .filter((row) => row.status !== "created")
      .map((row) => ({
        tipo: row.status,
        fila: row.row,
        documento: row.documento,
        campo: row.field ?? "",
        codigo: row.code ?? "",
        mensaje: row.reason,
      }));
    const csv = buildCsv([...validationRows, ...resultRows]);
    if (!csv.trim()) return;
    downloadTextFile(csv, "importacion-aprendices-errores.csv");
  }

  function downloadDuplicateConflictsCsv() {
    const duplicateRows = importRowResults
      .filter((row) => row.code === "DOCUMENT_EXISTS")
      .map((row) => ({
        fila: row.row,
        documento: row.documento,
        mensaje: row.reason,
        nombre_existente: row.existing_nombre ?? "",
        sede_existente: row.existing_sede ?? "",
      }));
    const csv = buildCsv(duplicateRows);
    if (!csv.trim()) return;
    downloadTextFile(csv, "importacion-aprendices-duplicados.csv");
  }

  async function validarImportacion() {
    if (!importFile) {
      setImportBanner({ type: "error", message: "Selecciona un archivo Excel o CSV antes de validar." });
      return;
    }

    setImportStage("parsing");
    setImportBanner(null);
    setValidandoImport(true);
    try {
      const form = new FormData();
      form.append("file", importFile);

      const res = await api.post("/api/usuarios/importar-aprendices/validar/", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = res?.data?.data ?? res?.data ?? {};
      const resumen = data.resumen ?? null;
      const errores: ImportValidationError[] = Array.isArray(data.errores) ? data.errores : [];
      const preview: ImportPreviewRow[] = Array.isArray(data.preview) ? data.preview : [];
      const dupes: ImportValidationError[] = Array.isArray(data.duplicates_in_file) ? data.duplicates_in_file : [];
      const rowNumbers: number[] = Array.isArray(data.row_numbers)
        ? data.row_numbers.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value) && value > 0)
        : [];

      setImportId(String(data.import_id ?? ""));
      setImportResumen(resumen);
      setImportErrores(errores);
      setImportPreviewRows(preview);
      setImportRowNumbers(rowNumbers);
      setImportRowResults([]);
      setDuplicatesInFile(dupes);
      setAllowSkipFileDuplicates(dupes.length === 0);
      setImportProgress({ processed: 0, total: rowNumbers.length });
      setImportStage("ready");
      if (dupes.length > 0) {
        setImportBanner({
          type: "error",
          message: "Se detectaron documentos duplicados en el archivo. Debes omitirlos o corregir el archivo antes de importar.",
        });
      } else {
        setImportBanner({
          type: "success",
          message: "Archivo validado. Puedes iniciar la importacion.",
        });
      }
    } catch (e: any) {
      const parsed = parseImportApiError(e);
      setImportStage("parsing");
      setImportBanner({ type: "error", message: parsed.bannerMessage || "No se pudo validar el archivo." });
    } finally {
      setValidandoImport(false);
    }
  }

  async function runImportByRows(rowNumbers: number[], opts: { appendToExisting: boolean }) {
    if (!importId) {
      setImportBanner({ type: "error", message: "Primero valida el archivo." });
      return;
    }
    if (duplicatesInFile.length > 0 && !allowSkipFileDuplicates) {
      setImportBanner({ type: "error", message: "Debes confirmar que omites duplicados del archivo para continuar." });
      return;
    }

    setImportStage("importing");
    setImportBanner(null);
    setConfirmandoImport(true);

    const CHUNK_SIZE = 50;
    let processed = 0;
    const total = rowNumbers.length;
    let merged = opts.appendToExisting ? [...importRowResults] : [];

    try {
      for (let i = 0; i < rowNumbers.length; i += CHUNK_SIZE) {
        const chunk = rowNumbers.slice(i, i + CHUNK_SIZE);
        const res = await api.post("/api/usuarios/importar-aprendices/confirmar/", {
          import_id: importId,
          allow_skip_file_duplicates: allowSkipFileDuplicates,
          row_numbers: chunk,
        });
        const data = res?.data?.data ?? res?.data ?? {};
        const parsedRows = parseRowErrors(data);
        merged = mergeImportRowResults(merged, parsedRows);
        processed += chunk.length;
        setImportProgress({ processed, total });
      }

      setImportRowResults(merged);
      const created = merged.filter((row) => row.status === "created").length;
      const skippedByRuntime = merged.filter((row) => row.status === "skipped").length;
      const skippedByValidation = importErrores.filter((err) => err.code === "DUPLICATE_IN_FILE").length;
      const failedByRuntime = merged.filter((row) => row.status === "failed").length;
      const failedByValidation = importErrores.length - skippedByValidation;
      const skipped = skippedByRuntime + skippedByValidation;
      const failed = failedByRuntime + failedByValidation;
      const summaryMessage = `Importacion finalizada: ${created} creados, ${skipped} omitidos, ${failed} fallidos.`;
      setImportBanner({
        type: failed > 0 ? "error" : "success",
        message: summaryMessage,
      });
      setPageBanner({
        type: failed > 0 ? "error" : "success",
        message: summaryMessage,
      });
      setImportStage("done");
      setPage(1);
      await cargar(1);

      const conflicts = merged.filter((row) => row.code === "DOCUMENT_EXISTS");
      if (conflicts.length > 0 && !hideConflictSummary) {
        setShowConflictsModal(true);
      }
    } catch (e: any) {
      const parsed = parseImportApiError(e);
      const backendCode = String(e?.response?.data?.code || "").toUpperCase();
      if (backendCode === "DUPLICATES_IN_FILE") {
        const backendDuplicates = e?.response?.data?.detail?.duplicates_in_file;
        if (Array.isArray(backendDuplicates)) {
          setDuplicatesInFile(backendDuplicates);
        }
      }
      setImportStage("ready");
      setImportBanner({ type: "error", message: parsed.bannerMessage || "No se pudo completar la importacion." });
    } finally {
      setConfirmandoImport(false);
    }
  }

  async function confirmarImportacion() {
    const rowNumbers = importRowNumbers;
    await runImportByRows(rowNumbers, { appendToExisting: false });
  }

  async function reintentarFallidos() {
    const retryRows = importRowResults
      .filter((row) => row.status === "failed" && row.code !== "DOCUMENT_EXISTS")
      .map((row) => Number(row.row))
      .filter((row) => Number.isFinite(row) && row > 0);
    if (!retryRows.length) {
      setImportBanner({ type: "error", message: "No hay filas fallidas elegibles para reintento." });
      return;
    }
    await runImportByRows(retryRows, { appendToExisting: true });
  }

  return (
    <div className="space-y-7 pb-2">
      <PageHeader
        breadcrumb="ADMIN > USUARIOS"
        title="Usuarios"
      description="Gestión de cuentas, roles, estado y carga de aprendices."
        actions={
          <>
            <Button onClick={abrirCrear} variant="primary">
              Crear usuario
            </Button>
            <Button onClick={abrirImportar} variant="primary">
              Cargar aprendices (Excel/CSV)
            </Button>
            <Button onClick={() => cargar(page)} variant="secondary">
              Recargar
            </Button>
          </>
        }
      />

      {pageBanner ? (
        <FormBanner type={pageBanner.type} message={pageBanner.message} className="rounded-2xl px-4 py-3" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <MetricPanel label="Total" value={stats.total} detail="universo" onClick={() => aplicarFiltrosDesdeCard({ rol: "todos", estado: "todos" })} />
            <MetricPanel label="Activos" value={stats.activos} detail="operativos" tone="success" onClick={() => aplicarFiltrosDesdeCard({ estado: "activo" })} />
            <MetricPanel label="Bloqueados" value={stats.bloqueados} detail="atencion" tone="danger" onClick={() => aplicarFiltrosDesdeCard({ estado: "bloqueado" })} />
            <MetricPanel label="Admins" value={stats.admins} detail="control" tone="info" onClick={() => aplicarFiltrosDesdeCard({ rol: "admin", estado: "todos" })} />
            <MetricPanel label="Guardas" value={stats.guardas} detail="cobertura" tone="info" onClick={() => aplicarFiltrosDesdeCard({ rol: "guarda", estado: "todos" })} />
            <MetricPanel label="Aprendices" value={stats.aprendices} detail="poblacion" tone="warning" onClick={() => aplicarFiltrosDesdeCard({ rol: "aprendiz", estado: "todos" })} />
          </>
        )}
      </div>

      {loading ? (
        <FilterSkeleton />
      ) : (
        <FilterBar
          footer={
            error ? (
              <div className="rounded-2xl border border-[color:rgba(255,107,122,0.28)] bg-[rgba(255,107,122,0.08)] p-3 text-sm text-[color:var(--danger)]">{error}</div>
            ) : null
          }
        >
          <div className="relative w-full md:col-span-12 lg:col-span-4">
            <input
              className="command-noir-control h-11 w-full px-3 py-2 text-sm outline-none transition"
              placeholder="Buscar: username, email, documento, nombre..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className="command-noir-control h-11 w-full px-3 py-2 text-sm outline-none transition md:col-span-4 lg:col-span-2"
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value as "todos" | "admin" | "guarda" | "aprendiz")}
          >
            <option value="todos">Rol: Todos</option>
            <option value="admin">Rol: admin</option>
            <option value="guarda">Rol: guarda</option>
            <option value="aprendiz">Rol: aprendiz</option>
          </select>

          <select
            className="command-noir-control h-11 w-full px-3 py-2 text-sm outline-none transition md:col-span-4 lg:col-span-2"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as "todos" | "activo" | "bloqueado")}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activo">Estado: activo</option>
            <option value="bloqueado">Estado: bloqueado</option>
          </select>

          <select
            className="command-noir-control h-11 w-full px-3 py-2 text-sm outline-none transition md:col-span-4 lg:col-span-2"
            value={sedeFilter}
            onChange={(e) => setSedeFilter(e.target.value)}
          >
            <option value="todos">Sede: Todas</option>
            {sedes.map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>

          <Button
            onClick={() => {
              setQ("");
              setRolFilter("todos");
              setEstadoFilter("todos");
              setSedeFilter("todos");
              setPage(1);
            }}
            className="h-11 md:col-span-6 lg:col-span-1"
            variant="secondary"
            disabled={!hasFilters}
          >
            Limpiar
          </Button>

          <div className="flex h-11 items-center justify-end md:col-span-6 lg:col-span-1">
            <span className="command-noir-chip whitespace-nowrap">
              {totalCount} usuarios
            </span>
          </div>
        </FilterBar>
      )}

      <div className="space-y-4">
        <DataTable
          loading={loadingTable}
          skeleton={<TableSkeleton rows={Math.min(8, pageSize)} />}
          hasRows={pageItems.length > 0}
          tableClassName="min-w-[980px] xl:min-w-full table-auto"
          headers={
            <tr className="text-left">
              <th className="w-14 p-3">ID</th>
              <th className="w-64 p-3">Usuario</th>
              <th className="w-52 p-3">Nombre</th>
              <th className="w-44 p-3">Rol</th>
              <th className="w-44 p-3">Estado</th>
              <th className="w-40 p-3">Documento</th>
              <th className="w-36 p-3">Sede</th>
              <th className="w-44 p-3">Programa</th>
              <th className="w-32 p-3 text-right">Acciones</th>
            </tr>
          }
          emptyState={
            <tr>
              <td className="p-10 text-center" colSpan={9}>
                <div className="mx-auto max-w-md">
                  <EmptyState
                    title="No hay usuarios para mostrar"
                    description="Prueba limpiando o ajustando los filtros activos."
                  />
                </div>
              </td>
            </tr>
          }
        >
          {pageItems.map((u, idx) => (
            <tr key={u.id} className={cx("align-top command-noir-table-row", idx % 2 === 1 && "bg-[color:rgba(255,255,255,0.015)]")}>
              <td className="command-noir-table-cell p-3">{u.id}</td>

              <td className="command-noir-table-cell p-3">
                <div className="max-w-[220px] truncate font-semibold text-[color:var(--color-text)]">{u.username}</div>
                {u.email ? <div className="max-w-[220px] truncate text-[color:var(--color-text-muted)]">{u.email}</div> : null}
              </td>

              <td className="command-noir-table-cell p-3">
                <div className="max-w-[180px] truncate">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "-"}</div>
              </td>

              <td className="p-3">
                <div className="flex flex-col gap-2">
                  <BadgeChip tone={u.rol === "admin" ? "purple" : u.rol === "guarda" ? "info" : "success"}>{u.rol ?? "-"}</BadgeChip>
                  <select
                    className="command-noir-control w-full rounded-xl p-2 outline-none transition"
                    value={u.rol ?? "aprendiz"}
                    onChange={(e) => inlinePatch(u.id, { rol: e.target.value })}
                    title="Cambiar rol (rapido)"
                    disabled={Boolean(rowSaving[u.id])}
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
                    className="command-noir-control w-full rounded-xl p-2 outline-none transition"
                    value={(u.estado ?? "activo").toLowerCase()}
                    onChange={(e) => inlinePatch(u.id, { estado: e.target.value })}
                    title="Cambiar estado (rapido)"
                    disabled={Boolean(rowSaving[u.id])}
                  >
                    <option value="activo">activo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                </div>
              </td>

              <td className="command-noir-table-cell p-3"><div className="max-w-[130px] truncate">{u.documento ?? "-"}</div></td>
              <td className="p-3">
                <div className="max-w-[110px] truncate">
                  {u.sede_principal ? sedesByCode.get(u.sede_principal) || u.sede_principal : "-"}
                </div>
              </td>
              <td className="command-noir-table-cell p-3"><div className="max-w-[170px] truncate">{u.programa_formacion ?? "-"}</div></td>

              <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={() => abrirEditar(u)}
                    variant="secondary"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={Boolean(rowSaving[u.id])}
                  >
                    Editar
                  </Button>
                  {rowSaving[u.id] ? <div className="text-[11px] text-[color:var(--color-text-muted)]">Guardando...</div> : null}
                  {rowError[u.id] ? (
                    <InlineNotice type="error" className="max-w-[190px] text-right" message={`No se pudo guardar. ${rowError[u.id]}`}>
                      {rowRetryPatch[u.id] ? (
                        <button
                          type="button"
                          onClick={() => inlinePatch(u.id, rowRetryPatch[u.id])}
                          className="ml-2 underline decoration-dotted underline-offset-2"
                          disabled={Boolean(rowSaving[u.id])}
                        >
                          Reintentar
                        </button>
                      ) : null}
                    </InlineNotice>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>

        <Pagination
          className="mt-1"
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
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

      {/* MODAL EDITAR */}
      {selected && (
        <Modal
          open={open}
          title={`Editar usuario #${selected.id} - ${selected.username}`}
          onClose={() => (!editSaving ? setOpen(false) : null)}
          maxWidthClassName="max-w-lg"
          closeDisabled={editSaving}
        >
          {editBanner ? (
            <FormBanner type={editBanner.type} message={editBanner.message} className="mb-3" />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <div className="text-xs text-[color:var(--color-text-muted)]">Rol</div>
              <select
                ref={editRolRef}
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.rol && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={rol}
                aria-invalid={Boolean(editFieldErrors.rol)}
                onChange={(e) => {
                  setRol(e.target.value);
                  clearEditFieldError("rol");
                  clearEditBanner();
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <FieldError text={editFieldErrors.rol} />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-[color:var(--color-text-muted)]">Estado</div>
              <select
                ref={editEstadoRef}
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.estado && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={estado.toLowerCase()}
                aria-invalid={Boolean(editFieldErrors.estado)}
                onChange={(e) => {
                  setEstado(e.target.value);
                  clearEditFieldError("estado");
                  clearEditBanner();
                }}
              >
                <option value="activo">activo</option>
                <option value="bloqueado">bloqueado</option>
              </select>
              <FieldError text={editFieldErrors.estado} />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <div className="text-xs text-[color:var(--color-text-muted)]">Correo (email)</div>
              <input
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.email && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={email}
                aria-invalid={Boolean(editFieldErrors.email)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearEditFieldError("email");
                  clearEditBanner();
                }}
                placeholder={emailPlaceholder}
              />
              <FieldError text={editFieldErrors.email} />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <div className="text-xs text-[color:var(--color-text-muted)]">Documento</div>
              <input
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.documento && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={documento}
                aria-invalid={Boolean(editFieldErrors.documento)}
                onChange={(e) => {
                  setDocumento(e.target.value);
                  clearEditFieldError("documento");
                  clearEditBanner();
                }}
                placeholder="QR / documento"
              />
              <FieldError text={editFieldErrors.documento} />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-[color:var(--color-text-muted)]">Sede principal</div>
              <select
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.sede_principal && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={sede}
                aria-invalid={Boolean(editFieldErrors.sede_principal)}
                onChange={(e) => {
                  setSede(e.target.value);
                  clearEditFieldError("sede_principal");
                  clearEditBanner();
                }}
              >
                <option value="">(sin sede)</option>
                {sede && !sedesByCode.has(sede) ? (
                  <option value={sede}>{`Sede eliminada/inactiva (${sede})`}</option>
                ) : null}
                {sedes.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              <FieldError text={editFieldErrors.sede_principal} />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-[color:var(--color-text-muted)]">Programa formacion</div>
              <input
                className={cx(
                  "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                  editFieldErrors.programa_formacion && "border-[color:rgba(255,107,122,0.45)]",
                )}
                value={programa}
                aria-invalid={Boolean(editFieldErrors.programa_formacion)}
                onChange={(e) => {
                  setPrograma(e.target.value);
                  clearEditFieldError("programa_formacion");
                  clearEditBanner();
                }}
                placeholder="ADSO..."
              />
              <FieldError text={editFieldErrors.programa_formacion} />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              disabled={editSaving}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-2 text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)] disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              disabled={editSaving}
              onClick={guardarModal}
              className="rounded-xl border border-[color:rgba(111,211,255,0.28)] bg-[linear-gradient(135deg,rgba(111,211,255,0.2),rgba(255,255,255,0.04))] px-4 py-2 text-[color:var(--color-text)] shadow-sm transition hover:border-[color:rgba(111,211,255,0.4)] disabled:opacity-50"
            >
              {editSaving ? "Guardando..." : "Guardar cambios"}
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
              {createBanner ? (
                <FormBanner type={createBanner.type} message={createBanner.message} className="mb-3" />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Username *</div>
                  <input
                    ref={createUsernameRef}
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.username && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_username}
                    aria-invalid={Boolean(createFieldErrors.username)}
                    onChange={(e) => {
                      setCUsername(e.target.value);
                      clearCreateFieldError("username");
                      clearCreateBanner();
                    }}
                  />
                  <FieldError text={createFieldErrors.username} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Password *</div>
                  <input
                    type="password"
                    ref={createPasswordRef}
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.password && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_password}
                    aria-invalid={Boolean(createFieldErrors.password)}
                    onChange={(e) => {
                      setCPassword(e.target.value);
                      clearCreateFieldError("password");
                      clearCreateBanner();
                    }}
                  />
                  <FieldError text={createFieldErrors.password} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Nombres</div>
                  <input
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.first_name && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_first}
                    aria-invalid={Boolean(createFieldErrors.first_name)}
                    onChange={(e) => {
                      setCFirst(e.target.value);
                      clearCreateFieldError("first_name");
                      clearCreateBanner();
                    }}
                  />
                  <FieldError text={createFieldErrors.first_name} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Apellidos</div>
                  <input
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.last_name && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_last}
                    aria-invalid={Boolean(createFieldErrors.last_name)}
                    onChange={(e) => {
                      setCLast(e.target.value);
                      clearCreateFieldError("last_name");
                      clearCreateBanner();
                    }}
                  />
                  <FieldError text={createFieldErrors.last_name} />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Email</div>
                  <input
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.email && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_email}
                    aria-invalid={Boolean(createFieldErrors.email)}
                    onChange={(e) => {
                      setCEmail(e.target.value);
                      clearCreateFieldError("email");
                      clearCreateBanner();
                    }}
                    placeholder={emailPlaceholder}
                  />
                  <FieldError text={createFieldErrors.email} />
                </label>

                <label className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Documento (QR)</div>
                  <input
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.documento && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_documento}
                    aria-invalid={Boolean(createFieldErrors.documento)}
                    onChange={(e) => {
                      setCDocumento(e.target.value);
                      clearCreateFieldError("documento");
                      clearCreateBanner();
                    }}
                    placeholder="1012345678"
                  />
                  <FieldError text={createFieldErrors.documento} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Rol</div>
                  <select
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.rol && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_rol}
                    aria-invalid={Boolean(createFieldErrors.rol)}
                    onChange={(e) => {
                      setCRol(e.target.value);
                      clearCreateFieldError("rol");
                      clearCreateBanner();
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <FieldError text={createFieldErrors.rol} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Estado</div>
                  <select
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.estado && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_estado}
                    aria-invalid={Boolean(createFieldErrors.estado)}
                    onChange={(e) => {
                      setCEstado(e.target.value);
                      clearCreateFieldError("estado");
                      clearCreateBanner();
                    }}
                  >
                    <option value="activo">activo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                  <FieldError text={createFieldErrors.estado} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Sede principal</div>
                  <select
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.sede_principal && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_sede}
                    aria-invalid={Boolean(createFieldErrors.sede_principal)}
                    onChange={(e) => {
                      setCSede(e.target.value);
                      clearCreateFieldError("sede_principal");
                      clearCreateBanner();
                    }}
                  >
                    <option value="">(sin sede)</option>
                    {c_sede && !sedesByCode.has(c_sede) ? (
                      <option value={c_sede}>{`Sede eliminada/inactiva (${c_sede})`}</option>
                    ) : null}
                    {sedes.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <FieldError text={createFieldErrors.sede_principal} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Programa</div>
                  <input
                    className={cx(
                      "command-noir-control w-full rounded-xl p-2 focus:outline-none",
                      createFieldErrors.programa_formacion && "border-[color:rgba(255,107,122,0.45)]",
                    )}
                    value={c_programa}
                    aria-invalid={Boolean(createFieldErrors.programa_formacion)}
                    onChange={(e) => {
                      setCPrograma(e.target.value);
                      clearCreateFieldError("programa_formacion");
                      clearCreateBanner();
                    }}
                    placeholder="COCINA / ADSO..."
                  />
                  <FieldError text={createFieldErrors.programa_formacion} />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpenCrear(false)}
                  disabled={creating}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-2 text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)] disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={crearUsuario}
                  disabled={creating}
                  className="rounded-xl border border-[color:rgba(111,211,255,0.28)] bg-[linear-gradient(135deg,rgba(111,211,255,0.2),rgba(255,255,255,0.04))] px-4 py-2 text-[color:var(--color-text)] shadow-sm transition hover:border-[color:rgba(111,211,255,0.4)] disabled:opacity-50"
                >
                  {creating ? "Creando..." : "Crear usuario"}
                </button>
              </div>
          </Modal>
        )}

        <Modal
          open={openImportar}
          title="Importar aprendices desde Excel/CSV"
          onClose={() => (!validandoImport && !confirmandoImport ? setOpenImportar(false) : null)}
          maxWidthClassName="max-w-5xl"
          closeDisabled={validandoImport || confirmandoImport}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.03)] p-3 text-sm text-[color:var(--color-text-soft)]">
              Flujo: 1) Selecciona el archivo. 2) Valida. 3) Importa. Los duplicados por documento siempre se omiten por seguridad.
            </div>

            {importBanner ? (
              <FormBanner type={importBanner.type} message={importBanner.message} />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end">
              <input
                type="file"
                accept=".xlsx,.xlsm,.xltx,.xltm,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="command-noir-control min-w-0 w-full rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={validarImportacion}
                disabled={!importFile || validandoImport || confirmandoImport}
                className="rounded-xl border border-[color:rgba(111,211,255,0.24)] bg-[linear-gradient(135deg,rgba(111,211,255,0.18),rgba(255,255,255,0.04))] px-4 py-2 text-sm font-medium text-[color:var(--color-text)] transition hover:border-[color:rgba(111,211,255,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validandoImport ? "Validando..." : "Validar archivo"}
              </button>
              <button
                onClick={confirmarImportacion}
                disabled={!importId || confirmandoImport || validandoImport || (duplicatesInFile.length > 0 && !allowSkipFileDuplicates)}
                className="rounded-xl border border-[color:rgba(66,199,154,0.25)] bg-[linear-gradient(135deg,rgba(66,199,154,0.16),rgba(255,255,255,0.04))] px-4 py-2 text-sm font-medium text-[color:var(--color-text)] transition hover:border-[color:rgba(66,199,154,0.38)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmandoImport ? "Importando..." : "Importar"}
              </button>
              <button
                onClick={reintentarFallidos}
                disabled={confirmandoImport || validandoImport || importRowResults.filter((row) => row.status === "failed" && row.code !== "DOCUMENT_EXISTS").length === 0}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reintentar fallidos
              </button>
            </div>

            {importResumen ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] p-3">
                  <div className="text-xs text-[color:var(--color-text-muted)]">Total</div>
                  <div className="text-xl font-semibold text-[color:var(--color-text)]">{importResumen.total}</div>
                </div>
                <div className="rounded-xl border border-[color:rgba(66,199,154,0.25)] bg-[rgba(66,199,154,0.08)] p-3">
                  <div className="text-xs text-[color:var(--success)]">Válidos</div>
                  <div className="text-xl font-semibold text-[color:var(--success)]">{importResumen.validos}</div>
                </div>
                <div className="rounded-xl border border-[color:rgba(255,107,122,0.26)] bg-[rgba(255,107,122,0.08)] p-3">
                  <div className="text-xs text-[color:var(--danger)]">Errores</div>
                  <div className="text-xl font-semibold text-[color:var(--danger)]">{importResumen.errores}</div>
                </div>
                <div className="rounded-xl border border-[color:rgba(240,178,77,0.28)] bg-[rgba(240,178,77,0.08)] p-3">
                  <div className="text-xs text-[color:var(--warning)]">Duplicados en archivo</div>
                  <div className="text-xl font-semibold text-[color:var(--warning)]">{duplicatesInFile.length}</div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                <span>Estado: {importStage}</span>
                <span>Progreso: {importProgress.processed}/{importProgress.total}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:rgba(255,255,255,0.06)]">
                <div
                  className="h-full bg-[linear-gradient(90deg,rgba(111,211,255,0.92),rgba(79,163,255,0.62))] transition-all"
                  style={{ width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {duplicatesInFile.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[color:rgba(240,178,77,0.28)]">
                <div className="border-b border-[color:rgba(240,178,77,0.28)] bg-[rgba(240,178,77,0.08)] px-4 py-2 text-sm font-semibold text-[color:var(--warning)]">
                  Duplicados en el archivo
                </div>
                <div className="max-h-48 overflow-auto bg-[color:rgba(10,16,24,0.86)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-[color:var(--color-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Documento</th>
                        <th className="px-3 py-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {duplicatesInFile.map((err, idx) => (
                        <tr key={`dup-${err.row}-${err.documento ?? ""}-${idx}`}>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2 font-medium text-[color:var(--warning)]">{err.documento ?? "-"}</td>
                          <td className="px-3 py-2 text-[color:var(--color-text-soft)]">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-[color:rgba(240,178,77,0.28)] bg-[rgba(240,178,77,0.08)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setAllowSkipFileDuplicates(true)}
                    className="rounded-lg border border-[color:rgba(240,178,77,0.28)] bg-[rgba(240,178,77,0.16)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] hover:bg-[rgba(240,178,77,0.22)]"
                  >
                    Omitir duplicados del archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowSkipFileDuplicates(false);
                      setImportBanner({ type: "error", message: "Corrige el archivo y vuelve a validar para continuar." });
                    }}
                    className="rounded-lg border border-[color:rgba(240,178,77,0.28)] bg-[color:rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-medium text-[color:var(--warning)] hover:bg-[rgba(240,178,77,0.12)]"
                  >
                    Cancelar y corregir Excel
                  </button>
                  <span className="text-xs text-[color:var(--warning)]">
                    Estado: {allowSkipFileDuplicates ? "Omisión de duplicados confirmada" : "Decisión pendiente"}
                  </span>
                </div>
              </div>
            ) : null}

            {importPreviewRows.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
                <div className="border-b border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-2 text-sm font-semibold text-[color:var(--color-text)]">
                  Vista previa de filas válidas ({importPreviewRows.length} de {importProgress.total})
                </div>
                <div className="max-h-56 overflow-auto bg-[color:rgba(10,16,24,0.86)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-[color:var(--color-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Documento</th>
                        <th className="px-3 py-2">Nombres</th>
                        <th className="px-3 py-2">Apellidos</th>
                        <th className="px-3 py-2">Username sugerido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreviewRows.map((row) => (
                        <tr key={`preview-${row.source_row}-${row.documento}`}>
                          <td className="px-3 py-2">{row.source_row}</td>
                          <td className="px-3 py-2">{row.documento}</td>
                          <td className="px-3 py-2">{row.first_name}</td>
                          <td className="px-3 py-2">{row.last_name}</td>
                          <td className="px-3 py-2">{row.username_sugerido}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {importRowResults.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
                <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-2">
                  <div className="text-sm font-semibold text-[color:var(--color-text)]">Resultados por fila</div>
                  <button
                    type="button"
                    onClick={downloadImportErrorsCsv}
                    className="rounded-lg border border-[color:var(--color-border)] bg-[color:rgba(10,16,24,0.86)] px-3 py-1 text-xs font-medium text-[color:var(--color-text-soft)] hover:bg-[color:rgba(255,255,255,0.06)]"
                  >
                    Descargar errores (CSV)
                  </button>
                </div>
                <div className="max-h-64 overflow-auto bg-[color:rgba(10,16,24,0.86)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-[color:var(--color-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Documento</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Mensaje</th>
                        <th className="px-3 py-2">Username</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importRowResults.map((row) => (
                        <tr key={`result-${row.row}-${row.documento}`}>
                          <td className="px-3 py-2">{row.row}</td>
                          <td className="px-3 py-2">{row.documento || "-"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cx(
                                "command-noir-chip px-2 py-1 text-xs font-semibold",
                                row.status === "created" && "bg-transparent text-[color:var(--success)]",
                                row.status === "skipped" && "bg-transparent text-[color:var(--warning)]",
                                row.status === "failed" && "bg-transparent text-[color:var(--danger)]",
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[color:var(--color-text-soft)]">{row.reason}</td>
                          <td className="px-3 py-2">{row.username_asignado ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {importErrores.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[color:rgba(255,107,122,0.26)]">
                <div className="flex items-center justify-between border-b border-[color:rgba(255,107,122,0.26)] bg-[rgba(255,107,122,0.08)] px-4 py-2">
                  <div className="text-sm font-semibold text-[color:var(--danger)]">Errores por fila</div>
                  <button
                    type="button"
                    onClick={downloadImportErrorsCsv}
                    className="rounded-lg border border-rose-300 bg-[color:rgba(10,16,24,0.86)] px-3 py-1 text-xs font-medium text-[color:var(--danger)] hover:bg-[rgba(255,107,122,0.12)]"
                  >
                    Descargar errores (CSV)
                  </button>
                </div>
                <div className="max-h-64 overflow-auto bg-[color:rgba(10,16,24,0.86)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-[color:var(--color-text-muted)]">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Documento</th>
                        <th className="px-3 py-2">Campo</th>
                        <th className="px-3 py-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importErrores.map((err, idx) => (
                        <tr key={`${err.row}-${err.code}-${idx}`}>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2">{err.documento ?? "-"}</td>
                          <td className="px-3 py-2">{err.field ?? err.fields?.join(", ") ?? "-"}</td>
                          <td className="px-3 py-2 text-[color:var(--color-text-soft)]">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>

        <Modal
          open={showConflictsModal}
          title="Conflictos de documento"
          onClose={() => setShowConflictsModal(false)}
          maxWidthClassName="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[color:rgba(240,178,77,0.28)] bg-[rgba(240,178,77,0.08)] px-4 py-3 text-sm text-[color:var(--warning)]">
              Estos aprendices ya existen. Por seguridad, no se crean duplicados.
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-[color:var(--color-border)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-[color:var(--color-text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Nombre existente</th>
                    <th className="px-3 py-2">Sede</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importRowResults
                    .filter((row) => row.code === "DOCUMENT_EXISTS")
                    .map((row) => (
                      <tr key={`conflict-${row.row}-${row.documento}`}>
                        <td className="px-3 py-2">{row.row}</td>
                        <td className="px-3 py-2">{row.documento}</td>
                        <td className="px-3 py-2">{row.existing_nombre ?? "-"}</td>
                        <td className="px-3 py-2">{row.existing_sede ?? "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-soft)]">
              <input
                type="checkbox"
                checked={hideConflictSummary}
                onChange={(e) => setHideConflictSummary(e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent"
              />
              No volver a mostrar este resumen en esta importación
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={downloadDuplicateConflictsCsv}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(10,16,24,0.86)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-soft)] hover:bg-[color:rgba(255,255,255,0.04)]"
              >
                Descargar reporte de duplicados (CSV)
              </button>
              <button
                type="button"
                onClick={() => setShowConflictsModal(false)}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(10,16,24,0.86)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-soft)] hover:bg-[color:rgba(255,255,255,0.04)]"
              >
                Cancelar para corregir Excel
              </button>
              <button
                type="button"
                onClick={() => setShowConflictsModal(false)}
                className="rounded-xl border border-[color:rgba(66,199,154,0.25)] bg-[linear-gradient(135deg,rgba(66,199,154,0.16),rgba(255,255,255,0.04))] px-4 py-2 text-sm font-medium text-[color:var(--color-text)] hover:border-[color:rgba(66,199,154,0.38)]"
              >
                Omitir y continuar
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}


