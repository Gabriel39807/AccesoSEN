export type Tokens = { access: string; refresh: string };

import { COOKIE_AUTH_MODE } from "./api-config";

let accessTokenMemory: string | null = null;

export const AUTH_WEB_FLOW = "access-memory-plus-refresh-cookie";

export function saveTokens(tokens: Tokens) {
  const access = String(tokens?.access || "").trim() || null;
  accessTokenMemory = access;
}

export function setAccessToken(access: string | null) {
  accessTokenMemory = access && access.trim() ? access.trim() : null;
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function getRefreshToken(): string | null {
  if (COOKIE_AUTH_MODE) return null;
  return null;
}

export function clearTokens() {
  accessTokenMemory = null;
}
