"use client";

import { createContext, useContext, useMemo } from "react";

import { useSystemTheme } from "@/hooks/useSystemTheme";

type InstitutionContextValue = {
  institutionName: string;
  sedeLabel: string;
  emailPlaceholder: string;
  loading: boolean;
};

const FALLBACK_INSTITUTION = (process.env.NEXT_PUBLIC_INSTITUTION_NAME || "Institucion").trim() || "Institucion";
const FALLBACK_SEDE_LABEL = (process.env.NEXT_PUBLIC_SEDE_LABEL || "La Sede").trim() || "La Sede";
const FALLBACK_EMAIL_DOMAIN =
  (process.env.NEXT_PUBLIC_EMAIL_PLACEHOLDER_DOMAIN || "institucion.local").replace("@", "").trim().toLowerCase() ||
  "institucion.local";

const InstitutionContext = createContext<InstitutionContextValue>({
  institutionName: FALLBACK_INSTITUTION,
  sedeLabel: FALLBACK_SEDE_LABEL,
  emailPlaceholder: `usuario@${FALLBACK_EMAIL_DOMAIN}`,
  loading: false,
});

export function InstitutionProvider({ children }: { children: React.ReactNode }) {
  const { config, loading } = useSystemTheme();

  const value = useMemo<InstitutionContextValue>(
    () => ({
      institutionName: (config?.nombre_institucion || FALLBACK_INSTITUTION).trim() || FALLBACK_INSTITUTION,
      sedeLabel: FALLBACK_SEDE_LABEL,
      emailPlaceholder: `usuario@${FALLBACK_EMAIL_DOMAIN}`,
      loading,
    }),
    [config, loading]
  );

  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}

export function useInstitution() {
  return useContext(InstitutionContext);
}
