"use client";

import { ThemeProvider } from "next-themes";

import RoleThemeProvider from "@/components/providers/RoleThemeProvider";
import { InstitutionProvider } from "@/context/institution-context";
import { SystemThemeProvider } from "@/hooks/useSystemTheme";

/**
 * Proveedores globales de cliente para toda la app web.
 * - next-themes: manejo y persistencia de modo light/dark.
 * - InstitutionProvider: branding dinámico de institución.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="sadi-theme" disableTransitionOnChange>
      <SystemThemeProvider>
        <InstitutionProvider>
          <RoleThemeProvider>{children}</RoleThemeProvider>
        </InstitutionProvider>
      </SystemThemeProvider>
    </ThemeProvider>
  );
}
