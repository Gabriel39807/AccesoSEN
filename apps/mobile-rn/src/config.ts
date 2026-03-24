/**
 * Mobile runtime configuration.
 *
 * Responsibility:
 * - Resolve API base URL from Expo public env variables.
 * - Normalize URL format to avoid malformed requests in production.
 */
// Configure EXPO_PUBLIC_API_URL in local `.env`.
// Examples:
// - http://192.168.1.100:8000
// - https://api.tu-dominio.com
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.22:8000";
const RAW_INSTITUTION_NAME = process.env.EXPO_PUBLIC_INSTITUTION_NAME || "Instituci�n";
const RAW_SEDE_LABEL = process.env.EXPO_PUBLIC_SEDE_LABEL || "La Sede";

/**
 * Normalizes backend URL by trimming spaces/trailing slashes and ensuring protocol.
 */
function normalizeApiUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://192.168.1.22:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export const API_URL = normalizeApiUrl(RAW_API_URL);
export const INSTITUTION_NAME = RAW_INSTITUTION_NAME.trim() || "Instituci�n";
export const SEDE_LABEL = RAW_SEDE_LABEL.trim() || "La Sede";
