"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Global dark/light toggle for web.
 * It is fixed at top-left so it is available in all modules.
 */
export default function GlobalThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const label = mounted ? (isDark ? "Modo claro" : "Modo oscuro") : "Cambiar tema";
  const title = mounted ? (isDark ? "Activar modo claro" : "Activar modo oscuro") : "Cambiar tema";
  const ariaLabel = mounted ? (isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro") : "Cambiar tema";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed left-3 top-3 z-[70] rounded-xl border border-surface-border bg-surface/95 px-3 py-2 text-xs font-semibold text-text shadow-sm backdrop-blur transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      title={title}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
