export type FieldErrors = Record<string, string>;
export type FieldErrorBag = Record<string, string[]>;
export type NormalizedApiErrors = {
  fieldErrors: FieldErrorBag;
  formErrors: string[];
};

const FIELD_LABELS: Record<string, string> = {
  username: "nombre de usuario",
  password: "contrasena",
  email: "correo",
  documento: "documento",
  telefono: "telefono",
  rol: "rol",
  estado: "estado",
  sede_principal: "sede principal",
  programa_formacion: "programa de formacion",
  jornada: "jornada",
  otp: "codigo OTP",
  new_password: "nueva contrasena",
  current_password: "contrasena actual",
};

function firstText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstText(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      const found = firstText(nested);
      if (found) return found;
    }
  }
  return null;
}

function sanitizeMessage(text: string, fallback: string): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;

  const looksTechnical = /<!doctype|<html|traceback|wsgirequest|server_name|remote_addr|python\d|\/usr\/|c:\\|environment variables|^path=/i.test(
    clean
  );
  if (looksTechnical) return fallback;

  if (clean.length > 280) return `${clean.slice(0, 280)}...`;
  return clean;
}

function asArrayMessages(value: unknown, fallback: string): string[] {
  const out: string[] = [];
  if (typeof value === "string") {
    out.push(sanitizeMessage(value, fallback));
    return out.filter(Boolean);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      out.push(...asArrayMessages(item, fallback));
    }
    return out.filter(Boolean);
  }
  if (value && typeof value === "object") {
    const maybeMsg = firstText((value as Record<string, unknown>).message);
    if (maybeMsg) out.push(sanitizeMessage(maybeMsg, fallback));
    else {
      const nested = firstText(value);
      if (nested) out.push(sanitizeMessage(nested, fallback));
    }
  }
  return out.filter(Boolean);
}

function addUnique(list: string[], value: string) {
  const clean = value.trim();
  if (!clean) return;
  if (!list.includes(clean)) list.push(clean);
}

function addFieldError(bag: FieldErrorBag, field: string, message: string) {
  const key = String(field || "").trim();
  const clean = String(message || "").trim();
  if (!key || !clean) return;
  if (!bag[key]) bag[key] = [];
  if (!bag[key].includes(clean)) bag[key].push(clean);
}

const GENERIC_KEYS = new Set([
  "code",
  "message",
  "motivo",
  "detail",
  "field",
  "permitido",
  "errors",
  "error",
  "status",
  "title",
]);

const NON_FIELD_KEYS = new Set(["non_field_errors", "__all__", "general", "form", "base_errors"]);

function collectFieldMapErrors(source: Record<string, unknown>, out: NormalizedApiErrors, fallback: string) {
  for (const [key, raw] of Object.entries(source)) {
    if (GENERIC_KEYS.has(key)) continue;
    const messages = asArrayMessages(raw, fallback);
    if (!messages.length) continue;

    if (NON_FIELD_KEYS.has(key)) {
      for (const msg of messages) addUnique(out.formErrors, msg);
      continue;
    }
    for (const msg of messages) addFieldError(out.fieldErrors, key, msg);
  }
}

export function normalizeApiErrors(
  input: unknown,
  fallback = "No se pudo procesar la solicitud. Intenta nuevamente."
): NormalizedApiErrors {
  const out: NormalizedApiErrors = { fieldErrors: {}, formErrors: [] };
  const wrapped =
    input && typeof input === "object" ? (input as { response?: { data?: unknown; status?: number }; code?: string; message?: string }) : {};
  const status = Number(wrapped?.response?.status || 0);
  const data = wrapped?.response?.data ?? input;

  const isNetworkLike =
    !!wrapped &&
    !wrapped.response &&
    (wrapped.code === "ECONNABORTED" ||
      /network|failed to fetch|timeout|socket|econnrefused|ecconnreset|load failed/i.test(String(wrapped.message || "")));

  if (isNetworkLike) {
    addUnique(out.formErrors, "No se pudo conectar con el servidor. Revisa tu red o intenta mas tarde.");
    return out;
  }

  if (status >= 500) {
    if (typeof console !== "undefined") {
      // Solo para diagnostico tecnico local; no se muestra al usuario.
      console.error("API 5xx error payload", input);
    }
    addUnique(out.formErrors, `Error del servidor (${status}). Si persiste, contacta al administrador.`);
    return out;
  }

  if (typeof data === "string") {
    addUnique(out.formErrors, sanitizeMessage(data, fallback));
  } else if (Array.isArray(data)) {
    for (const item of data) {
      for (const msg of asArrayMessages(item, fallback)) addUnique(out.formErrors, msg);
    }
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of ["message", "motivo", "error", "title"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        addUnique(out.formErrors, sanitizeMessage(value, fallback));
      }
    }

    if (typeof obj.detail === "string" && obj.detail.trim()) {
      addUnique(out.formErrors, sanitizeMessage(obj.detail, fallback));
    }

    if (typeof obj.field === "string") {
      const fieldMsg = firstText(obj.message) || firstText(obj.detail) || firstText(obj.motivo);
      if (fieldMsg) addFieldError(out.fieldErrors, obj.field, sanitizeMessage(fieldMsg, fallback));
    }

    if (obj.errors && typeof obj.errors === "object" && !Array.isArray(obj.errors)) {
      collectFieldMapErrors(obj.errors as Record<string, unknown>, out, fallback);
    }

    if (obj.detail && typeof obj.detail === "object" && !Array.isArray(obj.detail)) {
      collectFieldMapErrors(obj.detail as Record<string, unknown>, out, fallback);
    }

    collectFieldMapErrors(obj, out, fallback);
  }

  const hasFieldErrors = Object.keys(out.fieldErrors).length > 0;
  const hasFormErrors = out.formErrors.length > 0;
  if (!hasFieldErrors && !hasFormErrors) {
    if (status === 401 || status === 403) {
      addUnique(out.formErrors, "No tienes permisos para esta accion.");
    } else if (status === 404) {
      addUnique(out.formErrors, "Servicio no encontrado (404).");
    } else if (status === 409) {
      addUnique(out.formErrors, "Conflicto de datos (409). Verifica duplicados e intenta nuevamente.");
    } else if (status === 422) {
      addUnique(out.formErrors, "Hay errores de validacion. Revisa los campos e intenta nuevamente.");
    } else if (status === 423) {
      addUnique(out.formErrors, "Cuenta bloqueada temporalmente. Intenta nuevamente en unos minutos.");
    } else if (status === 429) {
      addUnique(out.formErrors, "Demasiadas solicitudes, intenta en unos minutos.");
    } else if (status >= 500) {
      addUnique(out.formErrors, `Error del servidor (${status}). Si persiste, contacta al administrador.`);
    } else if (status === 400) {
      addUnique(out.formErrors, "Hay errores en los datos del formulario. Revisa los campos e intenta de nuevo.");
    } else {
      addUnique(out.formErrors, sanitizeMessage(firstText(input) || "", fallback));
    }
  }

  return out;
}

export function toFieldErrors(input: unknown): FieldErrors {
  const out: FieldErrors = {};
  const normalized = normalizeApiErrors(input);
  for (const [field, messages] of Object.entries(normalized.fieldErrors)) {
    const msg = messages?.[0];
    if (msg) out[field] = msg;
  }
  return out;
}

export function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replaceAll("_", " ");
}

export function toErrorMessage(input: unknown, fallback = "Ocurrio un error inesperado. Intenta nuevamente."): string {
  const normalized = normalizeApiErrors(input, fallback);
  if (normalized.formErrors.length > 0) return normalized.formErrors[0];

  const fieldNames = Object.keys(normalized.fieldErrors);
  const firstField = fieldNames[0];
  if (firstField) {
    const firstMsg = normalized.fieldErrors[firstField]?.[0];
    if (firstMsg) return `Revisa el campo ${formatFieldLabel(firstField)}: ${firstMsg}`;
  }
  return fallback;
}
