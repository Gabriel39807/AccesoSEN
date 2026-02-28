export type Tokens = { access: string; refresh: string };

const ACCESS_KEY = "sadi_access";
const REFRESH_KEY = "sadi_refresh";
let accessTokenMemory: string | null = null;

/**
 * Acceso seguro a localStorage:
 * - Evita crashes en SSR (Server Components)
 * - Evita crashes si el navegador bloquea storage (modo incógnito / políticas)
 */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveTokens(t: Tokens) {
  accessTokenMemory = String(t?.access || "").trim() || null;
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function getRefreshToken(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function clearTokens() {
  accessTokenMemory = null;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACCESS_KEY);
    storage.removeItem(REFRESH_KEY);
  } catch {
    // noop
  }
}
