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
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * Normalizes backend URL by trimming spaces/trailing slashes and ensuring protocol.
 */
function normalizeApiUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export const API_URL = normalizeApiUrl(RAW_API_URL);
