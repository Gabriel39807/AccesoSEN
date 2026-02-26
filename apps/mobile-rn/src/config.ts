/**
 * Mobile runtime configuration.
 *
 * Responsibility:
 * - Resolve API base URL from Expo public env variables.
 * - Normalize URL format to avoid malformed requests in production.
 */
import Constants from "expo-constants";

// Configure EXPO_PUBLIC_API_URL in local `.env`.
// Examples:
// - http://192.168.1.100:8000
// - https://api.tu-dominio.com
const DEV_DEFAULT_API_URL = "http://127.0.0.1:8000";
const IS_DEV_RUNTIME = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";
const RAW_INSTITUTION_NAME = process.env.EXPO_PUBLIC_INSTITUTION_NAME || "Institucion";
const RAW_SEDE_LABEL = process.env.EXPO_PUBLIC_SEDE_LABEL || "La Sede";
const RAW_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const RAW_SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * During local Expo dev, infer API host from Metro host when EXPO_PUBLIC_API_URL is missing.
 */
function inferApiUrlFromExpoHost(): string | null {
  const hostUri = String(Constants.expoConfig?.hostUri || "").trim();
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return `http://${host}:8000`;
}

const RAW_API_URL =
  process.env.EXPO_PUBLIC_API_URL || (IS_DEV_RUNTIME ? inferApiUrlFromExpoHost() || DEV_DEFAULT_API_URL : "");

function isLoopbackHost(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
  }
}

/**
 * Normalizes backend URL by trimming spaces/trailing slashes and ensuring protocol.
 */
function normalizeApiUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return IS_DEV_RUNTIME ? DEV_DEFAULT_API_URL : "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const guessedProtocol = /localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])/.test(trimmed)
    ? "http"
    : "https";
  return `${guessedProtocol}://${trimmed}`;
}

export const API_URL = normalizeApiUrl(RAW_API_URL);
export const SUPABASE_URL = RAW_SUPABASE_URL.trim().replace(/\/+$/, "");
export const SUPABASE_PUBLISHABLE_KEY = RAW_SUPABASE_PUBLISHABLE_KEY.trim();
export const INSTITUTION_NAME = RAW_INSTITUTION_NAME.trim() || "Institucion";
export const SEDE_LABEL = RAW_SEDE_LABEL.trim() || "La Sede";

if (!IS_DEV_RUNTIME && !API_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in production runtime.");
}
if (!IS_DEV_RUNTIME && isLoopbackHost(API_URL)) {
  throw new Error("Invalid EXPO_PUBLIC_API_URL for production: localhost/loopback is not allowed.");
}
