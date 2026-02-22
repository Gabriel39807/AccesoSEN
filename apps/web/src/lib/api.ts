import axios, { AxiosHeaders } from "axios";
import { z } from "zod";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: API_BASE || undefined,
});

const nullableText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
});

const usuarioSchema = z
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

const equipoSchema = z
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

function isPaginatedPayload(value: unknown): value is { results: unknown[] } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { results?: unknown[] }).results));
}

function parseEntityPayload<T>(schema: z.ZodType<T>, data: unknown): unknown {
  if (Array.isArray(data)) {
    const parsed = z.array(schema).safeParse(data);
    return parsed.success ? parsed.data : data;
  }

  if (isPaginatedPayload(data)) {
    const paginatedSchema = z
      .object({
        count: z.number().optional(),
        next: z.any().nullable().optional(),
        previous: z.any().nullable().optional(),
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

function extractPath(url: unknown): string {
  const raw = String(url || "");
  if (!raw) return "";

  try {
    const parsed = new URL(raw, API_BASE || "http://localhost");
    return parsed.pathname;
  } catch {
    return raw.split("?")[0] || "";
  }
}

function normalizeResponseData(url: unknown, data: unknown): unknown {
  const path = extractPath(url);
  if (!path) return data;

  if (path.startsWith("/api/usuarios/") && !path.includes("/importar-aprendices/")) {
    return parseEntityPayload(usuarioSchema, data);
  }

  if (path.startsWith("/api/equipos/")) {
    return parseEntityPayload(equipoSchema, data);
  }

  return data;
}

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
