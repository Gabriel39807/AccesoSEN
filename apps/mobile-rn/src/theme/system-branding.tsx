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
  rolePalette: {
    admin: { light: string; dark: string };
    aprendiz: { light: string; dark: string };
    guarda: { light: string; dark: string };
  };
};

const DEFAULT_CONFIG: SystemBrandingConfig = {
  nombre_institucion: "Institucion",
  branding_preset: "command-noir",
  color_aprendiz_light: "#5FD1C4",
  color_aprendiz_dark: "#36B7A8",
  color_admin_light: "#7CC7FF",
  color_admin_dark: "#4FA3FF",
  color_guarda_light: "#6FD3FF",
  color_guarda_dark: "#2E7FE8",
};

const SystemBrandingContext = createContext<SystemBrandingContextValue>({
  config: DEFAULT_CONFIG,
  loading: false,
  refresh: async () => {},
  rolePalette: {
    admin: { light: DEFAULT_CONFIG.color_admin_light, dark: DEFAULT_CONFIG.color_admin_dark },
    aprendiz: { light: DEFAULT_CONFIG.color_aprendiz_light, dark: DEFAULT_CONFIG.color_aprendiz_dark },
    guarda: { light: DEFAULT_CONFIG.color_guarda_light, dark: DEFAULT_CONFIG.color_guarda_dark },
  },
});

export function SystemBrandingProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SystemBrandingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await api.get("/api/configuracion/");
      const payload = (response?.data?.configuracion || {}) as Partial<SystemBrandingConfig>;
      setConfig((prev) => ({
        ...DEFAULT_CONFIG,
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

  const rolePalette = useMemo(
    () => ({
      admin: { light: config.color_admin_light || DEFAULT_CONFIG.color_admin_light, dark: config.color_admin_dark || DEFAULT_CONFIG.color_admin_dark },
      aprendiz: {
        light: config.color_aprendiz_light || DEFAULT_CONFIG.color_aprendiz_light,
        dark: config.color_aprendiz_dark || DEFAULT_CONFIG.color_aprendiz_dark,
      },
      guarda: { light: config.color_guarda_light || DEFAULT_CONFIG.color_guarda_light, dark: config.color_guarda_dark || DEFAULT_CONFIG.color_guarda_dark },
    }),
    [config]
  );

  const value = useMemo<SystemBrandingContextValue>(
    () => ({
      config,
      loading,
      refresh,
      rolePalette,
    }),
    [config, loading, rolePalette]
  );

  return <SystemBrandingContext.Provider value={value}>{children}</SystemBrandingContext.Provider>;
}

export function useSystemBranding() {
  return useContext(SystemBrandingContext);
}
