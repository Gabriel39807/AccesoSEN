import axios from "axios";
import { API_URL } from "../config";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../storage/tokens";

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

function mapCodeToMessage(code?: string, fallback?: string) {
  const map: Record<string, string> = {
    INVALID_CREDENTIALS: "Usuario o contrasena invalidos.",
    ACCOUNT_LOCKED_15MIN: "Tu cuenta esta temporalmente bloqueada. Intenta en 15 minutos.",
    ACCOUNT_DISABLED_SECURITY: "Tu cuenta esta deshabilitada por seguridad. Contacta al administrador.",
    PASSWORD_RESET_REQUIRED: "Debes recuperar tu contrasena antes de iniciar sesion.",
    OTP_INVALID: "El codigo OTP no es valido.",
    OTP_EXPIRED: "El codigo OTP expiro. Solicita uno nuevo.",
    OTP_TOO_MANY_ATTEMPTS: "Demasiados intentos con OTP. Solicita uno nuevo.",
    TURNO_REQUIRED: "Debes iniciar turno para continuar.",
    TURNO_ALREADY_ACTIVE: "Ya tienes un turno activo.",
    ACCESO_INCONSISTENTE_EQUIPO: "Inconsistencia de equipos en el registro de acceso.",
    EQUIPO_LIMIT_REACHED: "Solo puedes registrar hasta 4 equipos.",
    MAX_ADMINS_PER_SEDE: "La sede ya alcanzo el limite de administradores.",
    PASSKEY_INVALID: "No se pudo validar la passkey.",
    NETWORK_ERROR: "No se pudo conectar al servidor.",
  };
  return (code && map[code]) || fallback || "Ocurrio un error. Intenta nuevamente.";
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = await getRefreshToken();
      if (!refresh) return null;
      const r = await axios.post(`${API_URL}/api/token/refresh/`, { refresh });
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
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config || {};
    if (error?.response?.status === 401 && !original._retry && !String(original?.url || "").includes("/api/token/")) {
      original._retry = true;
      try {
        const nextAccess = await refreshAccessToken();
        if (nextAccess) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${nextAccess}`;
          return api.request(original);
        }
      } catch {
        // ignore
      }
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        throw new UiError("El servidor esta tardando demasiado. Intenta de nuevo.", "NETWORK_ERROR");
      }
      throw new UiError(mapCodeToMessage("NETWORK_ERROR"), "NETWORK_ERROR");
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const code = data.code as string | undefined;
    const message = (data.message as string | undefined) || (data.motivo as string | undefined);
    const detail = data.detail;

    if (status === 401 || status === 423) {
      await clearTokens();
      throw new UiError(mapCodeToMessage(code, message), code || "INVALID_CREDENTIALS", detail, status);
    }
    if (status === 403) throw new UiError(mapCodeToMessage(code, message), code || "FORBIDDEN", detail, status);
    if (status === 404) throw new UiError(mapCodeToMessage(code, message), code || "NOT_FOUND", detail, status);
    if (status >= 500) throw new UiError("Error del servidor. Intenta mas tarde.", "SERVER_ERROR", detail, status);
    throw new UiError(mapCodeToMessage(code, message), code || "VALIDATION_ERROR", detail, status);
  }
);
