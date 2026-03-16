import axios from "axios";
import { API_URL } from "../config";
import { authenticateBiometric } from "../auth/biometric";
import {
  clearTokens,
  getAccessToken,
  getOrCreateDeviceId,
  getRefreshToken,
  isBiometricEnabled,
  saveTokens,
} from "../storage/tokens";

export class UiError extends Error {
  code?: string;
  detail?: any;
  status?: number;
  constructor(message: string, code?: string, detail?: any, status?: number) {
    super(message);
    this.name = "UiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

let refreshing: Promise<string | null> | null = null;

type FieldErrors = Record<string, string>;

function mapCodeToMessage(code?: string, fallback?: string) {
  const map: Record<string, string> = {
    INVALID_CREDENTIALS: "Usuario o contraseña inválidos.",
    ACCOUNT_LOCKED_15MIN: "Tu cuenta está temporalmente bloqueada. Intenta en 15 minutos.",
    ACCOUNT_DISABLED_SECURITY: "Tu cuenta está deshabilitada por seguridad. Contacta al administrador.",
    PASSWORD_RESET_REQUIRED: "Debes recuperar tu contraseña antes de iniciar sesión.",
    OTP_INVALID: "El código de verificación no es válido.",
    OTP_EXPIRED: "El código de verificación venció. Solicita uno nuevo.",
    OTP_TOO_MANY_ATTEMPTS: "Demasiados intentos con el código. Solicita uno nuevo.",
    TURNO_REQUIRED: "Debes iniciar turno para continuar.",
    TURNO_ALREADY_ACTIVE: "Ya tienes un turno activo.",
    ACCESO_INCONSISTENTE_EQUIPO: "Inconsistencia de equipos en el registro de acceso.",
    EQUIPO_LIMIT_REACHED: "Solo puedes registrar hasta 4 equipos.",
    MAX_ADMINS_PER_SEDE: "La sede ya alcanzó el límite de administradores.",
    PASSKEY_INVALID: "No se pudo validar la passkey.",
    NETWORK_ERROR: "No se pudo conectar al servidor.",
    VALIDATION_ERROR: "Revisa los datos ingresados.",
    NOT_AUTHENTICATED: "Tu sesión venció. Inicia sesión nuevamente.",
    PERMISSION_DENIED: "No tienes permisos para esta acción.",
  };
  return (code && map[code]) || fallback || "Ocurrió un error. Intenta nuevamente.";
}

const FIELD_LABELS: Record<string, string> = {
  username: "nombre de usuario",
  password: "contraseña",
  email: "correo",
  new_email: "nuevo correo",
  documento: "documento",
  telefono: "teléfono",
  rol: "rol",
  estado: "estado",
  sede_principal: "sede principal",
  programa_formacion: "programa de formación",
  jornada: "jornada",
  otp: "código de verificación",
  new_password: "nueva contraseña",
  current_password: "contraseña actual",
  serial: "serial",
  marca: "marca",
  modelo: "modelo",
  equipos: "equipos",
  propietario: "propietario",
  usuario: "usuario",
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

function pickDetail(input: unknown): unknown {
  const responseData =
    typeof input === "object" && input !== null && "response" in input
      ? (input as { response?: { data?: unknown } }).response?.data
      : undefined;

  const primary = responseData ?? input;
  if (primary && typeof primary === "object" && "detail" in primary) {
    const nested = (primary as { detail?: unknown }).detail;
    if (nested !== undefined) return nested;
  }
  if (input && typeof input === "object" && "detail" in input) {
    return (input as { detail?: unknown }).detail;
  }
  return primary;
}

export function formatUiFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replaceAll("_", " ");
}

export function toUiFieldErrors(input: unknown): FieldErrors {
  const detail = pickDetail(input);
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return {};

  const out: FieldErrors = {};
  for (const [field, value] of Object.entries(detail)) {
    if (field === "code" || field === "message" || field === "detail" || field === "motivo" || field === "permitido") continue;
    const message = firstText(value);
    if (!message) continue;
    out[field] = message;
  }
  return out;
}

export function toUiErrorMessage(input: unknown, fallback = "Ocurrió un error. Intenta nuevamente."): string {
  const responseData =
    typeof input === "object" && input !== null && "response" in input
      ? (input as { response?: { data?: unknown } }).response?.data
      : undefined;
  const data = responseData ?? input;
  const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (typeof dataObj?.message === "string" && dataObj.message.trim()) return sanitizeMessage(dataObj.message, fallback);
  if (typeof dataObj?.motivo === "string" && dataObj.motivo.trim()) return sanitizeMessage(dataObj.motivo, fallback);
  if (typeof dataObj?.detail === "string" && dataObj.detail.trim()) return sanitizeMessage(dataObj.detail, fallback);

  const fieldErrors = toUiFieldErrors(input);
  const firstField = Object.keys(fieldErrors)[0];
  if (firstField) return `Revisa el campo ${formatUiFieldLabel(firstField)}: ${fieldErrors[firstField]}`;

  if (typeof data === "string" && data.trim()) return sanitizeMessage(data, fallback);
  const inputObj = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (typeof inputObj?.message === "string" && inputObj.message.trim()) return sanitizeMessage(inputObj.message, fallback);
  if (data && typeof data === "object") {
    const nested = firstText(data);
    if (nested) return sanitizeMessage(nested, fallback);
  }
  return fallback;
}

function isAuthRequest(url: string): boolean {
  return (
    url.includes("/api/token/") ||
    url.includes("/api/auth/login/") ||
    url.includes("/api/auth/refresh/") ||
    url.includes("/api/auth/passkeys/")
  );
}

async function requestRefresh(refresh: string, deviceId: string) {
  try {
    return await axios.post(`${API_URL}/api/auth/refresh/`, { refresh, device_id: deviceId }, { timeout: 15000 });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return axios.post(`${API_URL}/api/token/refresh/`, { refresh, device_id: deviceId }, { timeout: 15000 });
    }
    throw error;
  }
}

export async function refreshAccessToken(options?: { requireBiometric?: boolean }): Promise<string | null> {
  const requireBiometric = Boolean(options?.requireBiometric);

  if (!refreshing) {
    refreshing = (async () => {
      const refresh = await getRefreshToken();
      if (!refresh) return null;

      if (requireBiometric) {
        const ok = await authenticateBiometric("Confirma tu identidad para renovar la sesión");
        if (!ok) throw new UiError("No se pudo validar la biometría. Usa tu contraseña.", "BIOMETRIC_AUTH_FAILED");
      }

      const deviceId = await getOrCreateDeviceId();
      let r;
      try {
        r = await requestRefresh(refresh, deviceId);
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 423) {
          await clearTokens();
        }
        throw error;
      }
      const nextAccess = r?.data?.access as string | undefined;
      const nextRefresh = (r?.data?.refresh as string | undefined) || refresh;
      if (!nextAccess) return null;
      await saveTokens(nextAccess, nextRefresh);
      return nextAccess;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.request.use(async (config) => {
  const [token, deviceId] = await Promise.all([getAccessToken(), getOrCreateDeviceId()]);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (deviceId) config.headers["X-Device-Id"] = deviceId;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config || {};
    const originalUrl = String(original?.url || "");
    if (error?.response?.status === 401 && !original._retry && !isAuthRequest(originalUrl)) {
      original._retry = true;
      try {
        const useBiometric = await isBiometricEnabled();
        if (useBiometric) {
          const nextAccess = await refreshAccessToken({ requireBiometric: true });
          if (nextAccess) {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${nextAccess}`;
            return api.request(original);
          }
        }
      } catch {
        // handled below
      }
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        throw new UiError("El servidor está tardando demasiado. Intenta de nuevo.", "NETWORK_ERROR");
      }
      throw new UiError(toUiErrorMessage(error, mapCodeToMessage("NETWORK_ERROR")), "NETWORK_ERROR");
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const code = data.code as string | undefined;
    const message = (data.message as string | undefined) || (data.motivo as string | undefined);
    const detail = data.detail;
    const mappedFallback = mapCodeToMessage(code, message);
    const uiMessage = toUiErrorMessage({ response: { data } }, mappedFallback);

    if ((status === 401 || status === 423) && !isAuthRequest(originalUrl)) {
      await clearTokens();
      throw new UiError(uiMessage, code || "INVALID_CREDENTIALS", detail, status);
    }
    if (status === 403) throw new UiError(uiMessage, code || "FORBIDDEN", detail, status);
    if (status === 404) throw new UiError(uiMessage, code || "NOT_FOUND", detail, status);
    if (status === 429) throw new UiError(uiMessage, code || "RATE_LIMIT", detail, status);
    if (status >= 500) {
      throw new UiError(toUiErrorMessage({ response: { data } }, "Error del servidor. Intenta más tarde."), "SERVER_ERROR", detail, status);
    }
    throw new UiError(uiMessage, code || "VALIDATION_ERROR", detail, status);
  }
);
