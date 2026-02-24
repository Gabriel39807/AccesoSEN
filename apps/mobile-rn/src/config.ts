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
const RAW_INSTITUTION_NAME = process.env.EXPO_PUBLIC_INSTITUTION_NAME || "Institucion";
const RAW_SEDE_LABEL = process.env.EXPO_PUBLIC_SEDE_LABEL || "La Sede";

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

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || inferApiUrlFromExpoHost() || DEV_DEFAULT_API_URL;

/**
 * Normalizes backend URL by trimming spaces/trailing slashes and ensuring protocol.
 */
function normalizeApiUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEV_DEFAULT_API_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export const API_URL = normalizeApiUrl(RAW_API_URL);
export const INSTITUTION_NAME = RAW_INSTITUTION_NAME.trim() || "Institucion";
export const SEDE_LABEL = RAW_SEDE_LABEL.trim() || "La Sede";
