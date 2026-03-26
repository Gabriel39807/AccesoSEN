"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";

import { DocumentViewerProvider } from "@/components/document/DocumentViewerProvider";
import { InstitutionProvider } from "@/context/institution-context";
import { SystemThemeProvider } from "@/hooks/useSystemTheme";

const RoleThemeProvider = dynamic(() => import("@/components/providers/RoleThemeProvider"), {
  ssr: false,
});

/**
 * Proveedores globales de cliente para toda la app web.
 * - next-themes: manejo y persistencia de modo light/dark.
 * - InstitutionProvider: branding dinamico de institucion.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="sadi-theme" disableTransitionOnChange>
      <SystemThemeProvider>
        <InstitutionProvider>
          <RoleThemeProvider>
            <DocumentViewerProvider>
              {children}
            </DocumentViewerProvider>
          </RoleThemeProvider>
        </InstitutionProvider>
      </SystemThemeProvider>
    </ThemeProvider>
  );
}
