// OJO: en el cel NO uses localhost.
// Usa la IP de tu PC (la misma que ves en el QR de Expo).
// Puedes escribir con o sin protocolo, por ejemplo:
// - "192.168.20.21:8000"
// - "http://192.168.20.21:8000"
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || "192.168.20.21:8000";

function normalizeApiUrl(value: string): string {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export const API_URL = normalizeApiUrl(RAW_API_URL);
