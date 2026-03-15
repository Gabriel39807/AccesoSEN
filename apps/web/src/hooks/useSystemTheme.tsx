"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

export type SystemThemeConfig = {
  nombre_institucion: string;
  branding_preset?: string | null;
  color_aprendiz_light: string;
  color_aprendiz_dark: string;
  color_admin_light: string;
  color_admin_dark: string;
  color_guarda_light: string;
  color_guarda_dark: string;
};

type SystemThemeContextValue = {
  config: SystemThemeConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT_CONFIG: SystemThemeConfig = {
  nombre_institucion: (process.env.NEXT_PUBLIC_INSTITUTION_NAME || "Institucion").trim() || "Institucion",
  branding_preset: null,
  color_aprendiz_light: "#14B8A6",
  color_aprendiz_dark: "#0F766E",
  color_admin_light: "#3B82F6",
  color_admin_dark: "#1E3A8A",
  color_guarda_light: "#F59E0B",
  color_guarda_dark: "#B45309",
};

const SystemThemeContext = createContext<SystemThemeContextValue>({
  config: DEFAULT_CONFIG,
  loading: false,
  refresh: async () => {},
});

/**
 * Global visual config provider.
 *
 * Fetches `/api/configuracion/` once and exposes values to all routes.
 */
export function SystemThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SystemThemeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await api.get("/api/configuracion/");
      const payload = (res?.data?.configuracion || {}) as Partial<SystemThemeConfig>;
      setConfig((prev) => ({
        ...prev,
        ...payload,
        nombre_institucion:
          (payload.nombre_institucion || prev.nombre_institucion || DEFAULT_CONFIG.nombre_institucion).trim() ||
          DEFAULT_CONFIG.nombre_institucion,
      }));
    } catch {
      setConfig((prev) => ({ ...DEFAULT_CONFIG, ...prev }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    function onRefreshRequested() {
      refresh();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("system-theme:refresh", onRefreshRequested);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("system-theme:refresh", onRefreshRequested);
      }
    };
  }, []);

  const value = useMemo<SystemThemeContextValue>(
    () => ({
      config,
      loading,
      refresh,
    }),
    [config, loading]
  );

  return <SystemThemeContext.Provider value={value}>{children}</SystemThemeContext.Provider>;
}

export function useSystemTheme() {
  return useContext(SystemThemeContext);
}
