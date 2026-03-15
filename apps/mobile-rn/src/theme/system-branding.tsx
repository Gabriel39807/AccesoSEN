import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";

export type SystemBrandingConfig = {
  nombre_institucion: string;
  branding_preset?: string | null;
  color_aprendiz_light: string;
  color_aprendiz_dark: string;
  color_admin_light: string;
  color_admin_dark: string;
  color_guarda_light: string;
  color_guarda_dark: string;
};

type SystemBrandingContextValue = {
  config: SystemBrandingConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT_CONFIG: SystemBrandingConfig = {
  nombre_institucion: "Institucion",
  branding_preset: null,
  color_aprendiz_light: "#14B8A6",
  color_aprendiz_dark: "#0F766E",
  color_admin_light: "#3B82F6",
  color_admin_dark: "#1E3A8A",
  color_guarda_light: "#F59E0B",
  color_guarda_dark: "#B45309",
};

const SystemBrandingContext = createContext<SystemBrandingContextValue>({
  config: DEFAULT_CONFIG,
  loading: false,
  refresh: async () => {},
});

export function SystemBrandingProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SystemBrandingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await api.get("/api/configuracion/");
      const payload = (response?.data?.configuracion || {}) as Partial<SystemBrandingConfig>;
      setConfig((prev) => ({
        ...prev,
        ...payload,
        nombre_institucion:
          String(payload.nombre_institucion || prev.nombre_institucion || DEFAULT_CONFIG.nombre_institucion).trim() ||
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

  const value = useMemo<SystemBrandingContextValue>(
    () => ({
      config,
      loading,
      refresh,
    }),
    [config, loading],
  );

  return <SystemBrandingContext.Provider value={value}>{children}</SystemBrandingContext.Provider>;
}

export function useSystemBranding() {
  return useContext(SystemBrandingContext);
}
