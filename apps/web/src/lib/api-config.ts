const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

export function normalizeApiBaseUrl(value: string): string {
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

function logApiBaseMisconfig(reason: string) {
  if (typeof console === "undefined") return;
  const message = `[api-config] ${reason} La web debe consumir la API Django/DRF, no el dominio del proyecto Supabase.`;
  if (ENFORCE_DEPLOY_API_URL_GUARD) {
    console.error(`${message} La app quedara sin API configurada hasta corregir NEXT_PUBLIC_API_URL.`);
    return;
  }
  console.warn(message);
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

export const RAW_API_BASE = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || "");
export const ENFORCE_DEPLOY_API_URL_GUARD =
  IS_PRODUCTION_BUILD &&
  (process.env.VERCEL === "1" || process.env.CI === "true" || process.env.STRICT_PUBLIC_API_URL === "true");
// Flujo oficial Fase 1: web usa exclusivamente refresh cookie HttpOnly.
export const COOKIE_AUTH_MODE = true;
export const API_TIMEOUT_MS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 20000);
  if (!Number.isFinite(raw)) return 20000;
  return Math.max(5000, Math.trunc(raw));
})();

function reportApiBaseGuard(reason: string) {
  if (!ENFORCE_DEPLOY_API_URL_GUARD || typeof console === "undefined") return;
  console.error(`[api-config] ${reason} La app quedara sin API configurada hasta corregir NEXT_PUBLIC_API_URL.`);
}

export function resolveApiBaseUrl(): string {
  if (isSupabaseProjectUrl(RAW_API_BASE)) {
    logApiBaseMisconfig("NEXT_PUBLIC_API_URL invalida: apunta a *.supabase.co.");
    return "";
  }
  if (!ENFORCE_DEPLOY_API_URL_GUARD) return RAW_API_BASE;
  if (!RAW_API_BASE) {
    reportApiBaseGuard("Falta NEXT_PUBLIC_API_URL en produccion.");
    return "";
  }
  if (isLoopbackHost(RAW_API_BASE)) {
    reportApiBaseGuard("NEXT_PUBLIC_API_URL invalida: localhost/loopback.");
    return "";
  }
  if (isPlaceholderApiHost(RAW_API_BASE)) {
    reportApiBaseGuard("NEXT_PUBLIC_API_URL invalida: dominio placeholder.");
    return "";
  }
  return RAW_API_BASE;
}

export const API_BASE = resolveApiBaseUrl();

export function joinApiPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}
