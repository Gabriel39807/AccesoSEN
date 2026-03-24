"use client";

import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo } from "react";

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: typeof SunMedium;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Claro", icon: SunMedium },
  { value: "dark", label: "Oscuro", icon: MoonStar },
  { value: "system", label: "Sistema", icon: Monitor },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function GlobalThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = typeof theme === "string" && theme.length > 0;

  const effectiveTheme = useMemo(() => {
    if (!mounted) return "system";
    return (theme as ThemeOption["value"] | undefined) ?? "system";
  }, [mounted, theme]);

  const currentLabel = useMemo(() => {
    if (!mounted) return "Tema del sistema";
    if (effectiveTheme === "system") {
      return `Sistema (${resolvedTheme === "dark" ? "oscuro" : "claro"})`;
    }
    return effectiveTheme === "dark" ? "Modo oscuro" : "Modo claro";
  }, [effectiveTheme, mounted, resolvedTheme]);

  return (
    <div className="w-full max-w-max">
      <div
        className="flex items-center justify-center gap-2 rounded-[1.1rem] border border-surface-border bg-surface-elevated/92 p-1 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="hidden pl-2 sm:block">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] sadi-kicker">Tema</p>
          <p className="text-[11px] font-semibold sadi-text-muted">{currentLabel}</p>
        </div>
        <div className="flex w-full items-center justify-center gap-1 rounded-[1rem] bg-surface-muted/90 p-1 sm:w-auto">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = effectiveTheme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cx(
                  "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[0.9rem] px-3 py-2 text-xs font-semibold transition duration-200 focus-visible:outline-none sm:flex-none",
                  active
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)]"
                    : "text-[color:var(--text-soft)] hover:bg-surface-elevated hover:text-foreground"
                )}
                style={active ? { boxShadow: "0 10px 24px color-mix(in srgb, var(--primary) 28%, transparent)" } : undefined}
                aria-pressed={active}
                aria-label={`Activar tema ${label.toLowerCase()}`}
                title={`Cambiar a ${label.toLowerCase()}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
