export type ParsedApiError = {
  status?: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

function isProbablyNetworkError(err: any): boolean {
  const rawMessage = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toUpperCase();
  return (
    !err?.response &&
    (code === "ECONNABORTED" ||
      rawMessage.includes("timeout") ||
      rawMessage.includes("network") ||
      rawMessage.includes("failed to fetch") ||
      rawMessage.includes("load failed"))
  );
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstString(item);
      if (nested) return nested;
    }
  }
  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      const nested = firstString(nestedValue);
      if (nested) return nested;
    }
  }
  return null;
}

function safeHumanFallback(): string {
  return "No se pudo completar la acción. Intenta nuevamente.";
}

function collectFieldErrors(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const reserved = new Set(["code", "detail", "message", "motivo", "status", "field", "errors", "error"]);

  const assignFirst = (field: string, raw: unknown) => {
    if (!field || reserved.has(field)) return;
    const msg = firstString(raw);
    if (!msg) return;
    out[field] = msg;
  };

  for (const [key, value] of Object.entries(data)) {
    if (reserved.has(key)) continue;
    if (key === "non_field_errors" || key === "__all__") continue;
    assignFirst(key, value);
  }

  const nestedErrors = data.errors;
  if (nestedErrors && typeof nestedErrors === "object" && !Array.isArray(nestedErrors)) {
    for (const [key, value] of Object.entries(nestedErrors as Record<string, unknown>)) {
      assignFirst(key, value);
    }
  }

  const nestedDetail = data.detail;
  if (nestedDetail && typeof nestedDetail === "object" && !Array.isArray(nestedDetail)) {
    for (const [key, value] of Object.entries(nestedDetail as Record<string, unknown>)) {
      assignFirst(key, value);
    }
  }

  return out;
}

export function parseApiError(err: any): ParsedApiError {
  const status = Number(err?.response?.status || 0) || undefined;
  const rawData = err?.response?.data;
  const code = typeof rawData?.code === "string" ? rawData.code : undefined;

  if (status === 403) {
    const msg403 = "No tienes permisos para realizar esta acción.";
    return { status, code, message: code ? `[${code}] ${msg403}` : msg403 };
  }

  if (isProbablyNetworkError(err)) {
    return {
      status,
      code,
      message: "No se pudo conectar. Revisa tu conexión e intenta de nuevo.",
    };
  }

  let message = "";
  let fieldErrors: Record<string, string> | undefined;

  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const data = rawData as Record<string, unknown>;
    fieldErrors = collectFieldErrors(data);
    message =
      firstString(data.detail) ||
      firstString(data.message) ||
      firstString(data.motivo) ||
      firstString(data.non_field_errors) ||
      "";
  } else if (typeof rawData === "string" && rawData.trim()) {
    message = rawData.trim();
  }

  if (!message && fieldErrors && Object.keys(fieldErrors).length > 0) {
    const firstField = Object.keys(fieldErrors)[0];
    message = `Revisa el campo ${firstField}: ${fieldErrors[firstField]}`;
  }

  if (!message) {
    const fallback = firstString(err?.message);
    message = fallback || safeHumanFallback();
  }

  if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
    fieldErrors = undefined;
  }

  return {
    status,
    code,
    message: code ? `[${code}] ${message}` : message,
    fieldErrors,
  };
}

