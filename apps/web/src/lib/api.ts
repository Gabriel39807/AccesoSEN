/**
 * Cliente HTTP central de la app web.
 *
 * Responsabilidad:
 * - Manejar autenticacion con access/refresh token.
 * - Normalizar respuestas del backend con Zod para evitar errores de render.
 * - Exponer DTOs tipados via `z.infer` como contrato de datos.
 */

import axios, { AxiosHeaders } from "axios";
import { z } from "zod";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./auth";

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";
const ENFORCE_DEPLOY_API_URL_GUARD =
  IS_PRODUCTION_BUILD &&
  (process.env.VERCEL === "1" || process.env.CI === "true" || process.env.STRICT_PUBLIC_API_URL === "true");
const DEPLOY_DEFAULT_API_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_DEPLOY_DEFAULT_API_URL || "https://sadi-api-genm.onrender.com"
);

function normalizeApiBaseUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}

function isLoopbackHost(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
  }
}

function isSupabaseProjectUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    return parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isPlaceholderApiHost(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    const host = parsed.hostname.toLowerCase();
    return (
      host === "api.tu-dominio.com" ||
      host.endsWith(".tu-dominio.com") ||
      host === "tu-dominio.com" ||
      host === "example.com" ||
      host.endsWith(".example.com")
    );
  } catch {
    return /tu-dominio\.com|example\.com/i.test(value);
  }
}

const RAW_API_BASE = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || "");
const COOKIE_AUTH_MODE =
  String(process.env.NEXT_PUBLIC_AUTH_COOKIE_MODE || "true").trim().toLowerCase() !== "false";
const API_TIMEOUT_MS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 20000);
  if (!Number.isFinite(raw)) return 20000;
  return Math.max(5000, Math.trunc(raw));
})();

function reportApiBaseGuard(reason: string) {
  if (!ENFORCE_DEPLOY_API_URL_GUARD || typeof console === "undefined") return;
  console.error(`[api-config] ${reason} Usando fallback ${DEPLOY_DEFAULT_API_URL}.`);
}

function resolveApiBaseUrl(): string {
  if (!ENFORCE_DEPLOY_API_URL_GUARD) return RAW_API_BASE;
  if (!RAW_API_BASE) {
    reportApiBaseGuard("Falta NEXT_PUBLIC_API_URL en produccion.");
    return DEPLOY_DEFAULT_API_URL || RAW_API_BASE;
  }
  if (isLoopbackHost(RAW_API_BASE)) {
    reportApiBaseGuard("NEXT_PUBLIC_API_URL invalida: localhost/loopback.");
    return DEPLOY_DEFAULT_API_URL || RAW_API_BASE;
  }
  if (isSupabaseProjectUrl(RAW_API_BASE)) {
    reportApiBaseGuard("NEXT_PUBLIC_API_URL invalida: apunta a *.supabase.co.");
    return DEPLOY_DEFAULT_API_URL || RAW_API_BASE;
  }
  if (isPlaceholderApiHost(RAW_API_BASE)) {
    reportApiBaseGuard("NEXT_PUBLIC_API_URL invalida: dominio placeholder.");
    return DEPLOY_DEFAULT_API_URL || RAW_API_BASE;
  }
  return RAW_API_BASE;
}

function joinApiPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

const API_BASE = resolveApiBaseUrl();
export const api = axios.create({
  baseURL: API_BASE || undefined,
  withCredentials: COOKIE_AUTH_MODE,
  timeout: API_TIMEOUT_MS,
});

const nullableText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
});

/**
 * Schema de Usuario basado en `UsuarioSerializer` de Django.
 */
export const usuarioSchema = z
  .object({
    id: z.number(),
    username: z.string(),
    rol: z.string(),
    first_name: z.string().optional().default(""),
    last_name: z.string().optional().default(""),
    email: nullableText,
    documento: nullableText,
    telefono: nullableText,
    jornada: nullableText,
    programa_formacion: nullableText,
    estado: nullableText,
    sede_principal: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return null;
      return String(value);
    }),
  })
  .passthrough();

/**
 * Schema de perfil de aprendiz basado en `AprendizPerfilSerializer`.
 */
export const aprendizPerfilSchema = z
  .object({
    id: z.number(),
    username: z.string(),
    email: nullableText,
    first_name: z.string().default(""),
    last_name: z.string().default(""),
    documento: nullableText,
    rol: z.string(),
    estado: z.string(),
    sede_principal: nullableText,
    jornada: nullableText,
    programa_formacion: nullableText,
    telefono: nullableText,
    must_change_password: z.boolean().default(false),
    force_password_reset: z.boolean().default(false),
    pending_email_change: nullableText.optional().default(null),
  })
  .passthrough();

/**
 * Schema de Equipo basado en `EquipoSerializer`.
 */
export const equipoSchema = z
  .object({
    id: z.number(),
    serial: z.string(),
    marca: z.string(),
    modelo: z.string(),
    estado: z.string(),
    propietario: z.union([z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return null;
      return Number(value);
    }),
    motivo_rechazo: nullableText,
    revisado_por: z.union([z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return null;
      return Number(value);
    }),
    revisado_en: nullableText,
    creado_en: nullableText,
  })
  .passthrough();

/**
 * Schema de Acceso basado en `AccesoSerializer`.
 */
export const accesoSchema = z
  .object({
    id: z.number(),
    usuario: z.number(),
    fecha: z.string(),
    tipo: z.string(),
    sede: nullableText,
    sede_name: nullableText,
    registrado_por: z.union([z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return null;
      return Number(value);
    }),
    turno: z.union([z.number(), z.null(), z.undefined()]).transform((value) => {
      if (value === null || value === undefined) return null;
      return Number(value);
    }),
    equipos: z.array(z.number()).optional().default([]),
  })
  .passthrough();

export type UsuarioDto = z.infer<typeof usuarioSchema>;
export type AprendizPerfilDto = z.infer<typeof aprendizPerfilSchema>;
export type EquipoDto = z.infer<typeof equipoSchema>;
export type AccesoDto = z.infer<typeof accesoSchema>;

function isPaginatedPayload(value: unknown): value is { results: unknown[] } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { results?: unknown[] }).results));
}

/**
 * Parsea payloads de entidades aisladas, listas o paginados.
 */
function parseEntityPayload<T>(schema: z.ZodType<T>, data: unknown): unknown {
  if (Array.isArray(data)) {
    const parsed = z.array(schema).safeParse(data);
    return parsed.success ? parsed.data : data;
  }

  if (isPaginatedPayload(data)) {
    const paginatedSchema = z
      .object({
        count: z.number().optional(),
        next: z.unknown().nullable().optional(),
        previous: z.unknown().nullable().optional(),
        results: z.array(schema),
      })
      .passthrough();
    const parsed = paginatedSchema.safeParse(data);
    return parsed.success ? parsed.data : data;
  }

  if (data && typeof data === "object") {
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : data;
  }

  return data;
}

/**
 * Parsea respuestas con forma `{ perfil: ... }` del módulo aprendiz.
 */
function parseAprendizPerfilPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const wrapperSchema = z.object({ perfil: aprendizPerfilSchema }).passthrough();
  const parsed = wrapperSchema.safeParse(data);
  return parsed.success ? parsed.data : data;
}

function extractPath(url: unknown): string {
  const raw = String(url || "");
  if (!raw) return "";

  try {
    const parsed = new URL(raw, API_BASE || "http://placeholder.invalid");
    return parsed.pathname;
  } catch {
    return raw.split("?")[0] || "";
  }
}

/**
 * Normaliza respuestas GET por recurso para evitar crashes por nulos/campos opcionales.
 */
function normalizeResponseData(url: unknown, data: unknown): unknown {
  const path = extractPath(url);
  if (!path) return data;

  if (path.startsWith("/api/usuarios/") && !path.includes("/importar-aprendices/")) {
    return parseEntityPayload(usuarioSchema, data);
  }

  if (path.startsWith("/api/aprendiz/perfil/")) {
    return parseAprendizPerfilPayload(data);
  }

  if (path.startsWith("/api/equipos/")) {
    return parseEntityPayload(equipoSchema, data);
  }

  if (path.startsWith("/api/accesos/")) {
    return parseEntityPayload(accesoSchema, data);
  }

  return data;
}

let refreshing: Promise<string | null> | null = null;

/**
 * Intenta renovar el access token usando refresh token almacenado.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = getRefreshToken();
      const payload: Record<string, string> = {};
      if (refresh) payload.refresh = refresh;
      if (COOKIE_AUTH_MODE) payload.auth_transport = "cookie";
      if (!refresh && !COOKIE_AUTH_MODE) return null;
      const r = await axios.post(joinApiPath("/api/token/refresh/"), payload, {
        withCredentials: COOKIE_AUTH_MODE,
        headers: COOKIE_AUTH_MODE ? { "X-Auth-Transport": "cookie" } : undefined,
        timeout: API_TIMEOUT_MS,
      });
      const nextAccess = r?.data?.access as string | undefined;
      const nextRefresh = (r?.data?.refresh as string | undefined) || refresh;
      if (!nextAccess) return null;
      saveTokens({ access: nextAccess, refresh: nextRefresh || "" });
      return nextAccess;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (!token) return config;
  const headers = AxiosHeaders.from(config.headers);
  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (String(response?.config?.method || "get").toLowerCase() === "get") {
      response.data = normalizeResponseData(response?.config?.url, response.data);
    }
    return response;
  },
  async (err) => {
    const original = err?.config || {};
    if (err?.response?.status === 401 && !original._retry && !String(original?.url || "").includes("/api/token/")) {
      original._retry = true;
      try {
        const next = await refreshAccessToken();
        if (next) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${next}`;
          return api.request(original);
        }
      } catch {
        // Se delega al manejo global de error.
      }
    }

    if ((err?.response?.status === 401 || err?.response?.status === 423) && typeof window !== "undefined") {
      clearTokens();
      const isLogin = window.location?.pathname?.startsWith("/login");
      if (!isLogin) window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);
