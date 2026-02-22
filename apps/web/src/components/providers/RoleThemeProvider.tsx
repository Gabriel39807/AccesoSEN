"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { useSystemTheme } from "@/hooks/useSystemTheme";

type RoleScope = "aprendiz" | "admin" | "guarda";

function resolveRoleScope(pathname: string): RoleScope {
  const path = (pathname || "").toLowerCase();
  if (path.includes("/aprendiz")) return "aprendiz";
  if (path.includes("/guard") || path.includes("/guarda")) return "guarda";
  return "admin";
}

/**
 * Injects CSS role color based on current route and light/dark mode.
 */
export default function RoleThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { config } = useSystemTheme();

  const scope = useMemo(() => resolveRoleScope(pathname || ""), [pathname]);
  const isDark = resolvedTheme === "dark";

  const primaryColor = useMemo(() => {
    if (scope === "aprendiz") return isDark ? config.color_aprendiz_dark : config.color_aprendiz_light;
    if (scope === "guarda") return isDark ? config.color_guarda_dark : config.color_guarda_light;
    return isDark ? config.color_admin_dark : config.color_admin_light;
  }, [config, scope, isDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", primaryColor);
    root.style.setProperty("--primary", primaryColor);
    root.setAttribute("data-role-scope", scope);
  }, [primaryColor, scope]);

  return <>{children}</>;
}
