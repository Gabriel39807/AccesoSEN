import { utils, write } from "xlsx";

export const TECHNICAL_USER_ROLES = ["superadmin", "admin_sede", "guarda", "aprendiz"] as const;
export const APRENDIZ_IMPORT_FORMATS = [".csv", ".xlsx", ".xlsm", ".xltx", ".xltm"] as const;
export const APRENDIZ_IMPORT_JORNADAS = ["MAÑANA", "TARDE", "NOCHE"] as const;
export const APRENDIZ_IMPORT_TEMPLATE_SHEET_NAME = "Aprendices";
export const APRENDIZ_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type TechnicalUserRole = (typeof TECHNICAL_USER_ROLES)[number];
export type UserReadRole = TechnicalUserRole | "admin" | string | null | undefined;
export type UserFilterRole = "todos" | TechnicalUserRole;
export type UserStateFilter = "todos" | "activo" | "bloqueado";
export type UserDeleteTarget = {
  rol?: UserReadRole;
  sede_principal?: string | null;
};

type AprendizImportTemplateInput = {
  actorRole: UserReadRole;
  programas?: string[];
};

type AprendizImportTemplateFormat = "csv" | "xlsx";

type UserListParamsInput = {
  actorRole: UserReadRole;
  actorSede: string | null | undefined;
  query: string;
  roleFilter: UserFilterRole;
  stateFilter: UserStateFilter;
  sedeFilter: string;
  page: number;
  pageSize: number;
};

type UserMutationPayloadInput = {
  actorRole: UserReadRole;
  actorSede: string | null | undefined;
  role: string;
  estado: string;
  email?: string | null;
  sede_principal?: string | null;
  programa_formacion?: string | null;
  documento?: string | null;
};

function normalize(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function isTechnicalUserRole(value: UserReadRole): value is TechnicalUserRole {
  const normalized = normalize(value);
  return (TECHNICAL_USER_ROLES as readonly string[]).includes(normalized);
}

export function isLegacyAdminRole(value: UserReadRole): boolean {
  return normalize(value) === "admin";
}

export function isAdministrativeRole(value: UserReadRole): boolean {
  const normalized = normalize(value);
  return normalized === "superadmin" || normalized === "admin_sede";
}

export function isAdministrativeOrLegacyRole(value: UserReadRole): boolean {
  return isAdministrativeRole(value) || isLegacyAdminRole(value);
}

export function getRoleBadgeTone(value: UserReadRole): "purple" | "info" | "success" | "warning" | "neutral" {
  const normalized = normalize(value);
  if (normalized === "superadmin") return "purple";
  if (normalized === "admin_sede") return "info";
  if (normalized === "guarda") return "info";
  if (normalized === "aprendiz") return "success";
  if (normalized === "admin") return "warning";
  return "neutral";
}

export function getRoleBadgeLabel(value: UserReadRole): string {
  const normalized = normalize(value);
  if (normalized === "admin") return "admin (legacy)";
  return normalized || "-";
}

export function getVisibleRoleOptions(actorRole: UserReadRole): TechnicalUserRole[] {
  const normalized = normalize(actorRole);
  if (normalized === "superadmin") return [...TECHNICAL_USER_ROLES];
  if (normalized === "admin_sede") return ["guarda", "aprendiz"];
  return [];
}

export function getVisibleRoleFilters(actorRole: UserReadRole): TechnicalUserRole[] {
  return getVisibleRoleOptions(actorRole);
}

export function canManageRole(actorRole: UserReadRole, targetRole: UserReadRole): boolean {
  const normalizedTarget = normalize(targetRole);
  if (!normalizedTarget) return false;
  return getVisibleRoleOptions(actorRole).includes(normalizedTarget as TechnicalUserRole);
}

export function canDeleteByRole(
  actorRole: UserReadRole,
  actorSede: string | null | undefined,
  target: UserDeleteTarget,
): boolean {
  const normalizedActor = normalize(actorRole);
  const normalizedActorSede = normalize(actorSede);
  const normalizedTargetRole = normalize(target.rol);
  const normalizedTargetSede = normalize(target.sede_principal);

  if (!normalizedTargetRole) return false;
  if (normalizedActor === "superadmin") return true;

  if (normalizedActor === "admin_sede") {
    if (!normalizedActorSede) return false;
    if (normalizedTargetRole !== "guarda" && normalizedTargetRole !== "aprendiz") return false;
    return normalizedTargetSede !== "" && normalizedTargetSede === normalizedActorSede;
  }

  return false;
}

export function shouldHideRoleFromAdminSede(actorRole: UserReadRole, targetRole: UserReadRole): boolean {
  return normalize(actorRole) === "admin_sede" && isAdministrativeOrLegacyRole(targetRole);
}

export function getScopedSede(actorRole: UserReadRole, actorSede: string | null | undefined, requestedSede: string | null | undefined): string | null {
  if (normalize(actorRole) === "admin_sede") {
    const scoped = String(actorSede || "").trim();
    return scoped || null;
  }
  const requested = String(requestedSede || "").trim();
  return requested || null;
}

export function buildUserListParams(input: UserListParamsInput): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: input.page,
    page_size: input.pageSize,
  };

  const query = input.query.trim();
  if (query) params.q = query;

  if (input.roleFilter !== "todos") params.rol = input.roleFilter;
  if (input.stateFilter !== "todos") params.estado = input.stateFilter;

  const scopedSede = getScopedSede(input.actorRole, input.actorSede, input.sedeFilter === "todos" ? null : input.sedeFilter);
  if (scopedSede) params.sede_principal = scopedSede;

  return params;
}

export function buildUserMutationPayload(input: UserMutationPayloadInput) {
  const scopedSede = getScopedSede(input.actorRole, input.actorSede, input.sede_principal);
  return {
    rol: normalize(input.role),
    estado: normalize(input.estado),
    email: input.email?.trim() ? input.email.trim() : undefined,
    sede_principal: scopedSede,
    programa_formacion: input.programa_formacion?.trim() ? input.programa_formacion.trim() : undefined,
    documento: input.documento?.trim() ? input.documento.trim() : undefined,
  };
}

export function getAprendizImportTemplateColumns(actorRole: UserReadRole): string[] {
  const columns = ["Nombres", "Apellidos", "Documento", "Telefono", "Correo", "Jornada", "Programa"];
  if (normalize(actorRole) !== "admin_sede") columns.push("Sede");
  return columns;
}

export function buildAprendizImportTemplateFilename(actorRole: UserReadRole, format: AprendizImportTemplateFormat): string {
  const scope = normalize(actorRole) === "admin_sede" ? "admin-sede" : "superadmin";
  return `plantilla-importacion-aprendices-${scope}.${format}`;
}

export function buildAprendizImportTemplateRows(input: AprendizImportTemplateInput): string[][] {
  return [getAprendizImportTemplateColumns(input.actorRole)];
}

export function buildAprendizImportTemplateCsv(input: AprendizImportTemplateInput): string {
  const [columns] = buildAprendizImportTemplateRows(input);
  return `\uFEFF${columns.join(",")}\n`;
}

export function buildAprendizImportTemplateWorkbook(input: AprendizImportTemplateInput): ArrayBuffer {
  const rows = buildAprendizImportTemplateRows(input);
  const worksheet = utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0].map((column) => ({ wch: Math.max(column.length + 4, 16) }));
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, APRENDIZ_IMPORT_TEMPLATE_SHEET_NAME);

  const programas = Array.isArray(input.programas) ? input.programas.map((item) => item.trim()).filter(Boolean) : [];
  if (programas.length > 0) {
    const catalogRows = [["Programas aceptados"], ...programas.map((programa) => [programa])];
    const catalogSheet = utils.aoa_to_sheet(catalogRows);
    catalogSheet["!cols"] = [{ wch: 48 }];
    utils.book_append_sheet(workbook, catalogSheet, "Programas");
  }

  return write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function buildAprendizImportFormData(file: Blob, filename?: string): FormData {
  const form = new FormData();
  const fallbackName = typeof filename === "string" && filename.trim().length > 0 ? filename.trim() : "aprendices.xlsx";
  form.append("file", file, fallbackName);
  return form;
}

export function formatFileSize(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (safeBytes < 1024) return `${safeBytes} B`;
  if (safeBytes < 1024 * 1024) return `${(safeBytes / 1024).toFixed(1)} KB`;
  return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAprendizImportFile(file: Pick<File, "name" | "size"> | null | undefined): string | null {
  if (!file) return "Selecciona un archivo antes de continuar.";

  const lowerName = String(file.name || "").trim().toLowerCase();
  const fileSupported = APRENDIZ_IMPORT_FORMATS.some((extension) => lowerName.endsWith(extension));
  if (!fileSupported) {
    return `Formato no soportado. Usa ${APRENDIZ_IMPORT_FORMATS.join(", ").toUpperCase()}.`;
  }

  const size = Number(file.size || 0);
  if (size <= 0) {
    return "El archivo esta vacio. Descarga la plantilla y completa al menos una fila.";
  }

  if (size > APRENDIZ_IMPORT_MAX_FILE_SIZE_BYTES) {
    return `El archivo supera el maximo de ${formatFileSize(APRENDIZ_IMPORT_MAX_FILE_SIZE_BYTES)}.`;
  }

  return null;
}
