import axios from "axios";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: API_BASE || undefined,
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return null;
      const r = await axios.post(`${API_BASE}/api/token/refresh/`, { refresh });
      const nextAccess = r?.data?.access as string | undefined;
      const nextRefresh = (r?.data?.refresh as string | undefined) || refresh;
      if (!nextAccess) return null;
      saveTokens({ access: nextAccess, refresh: nextRefresh });
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
  const h: any = config.headers ?? {};
  if (typeof h.set === "function") {
    h.set("Authorization", `Bearer ${token}`);
    config.headers = h;
  } else {
    config.headers = h;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
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
        // handled below
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
