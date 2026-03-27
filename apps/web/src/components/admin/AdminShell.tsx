"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Monitor, MoonStar, SunMedium } from "lucide-react";

import SidebarItem from "@/components/aprendiz/dashboard/SidebarItem";
import {
  IconClock,
  IconHistory,
  IconHome,
  IconLaptop,
  IconLogout,
  IconRefresh,
  IconShield,
  IconUser,
} from "@/components/aprendiz/dashboard/DashboardIcons";
import { useMe } from "@/hooks/useMe";
import { logoutCurrentSession } from "@/lib/logout";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: SunMedium },
  { value: "dark", label: "Oscuro", icon: MoonStar },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

function ThemeSwitcher({ dense = false, collapsed = false }: { dense?: boolean; collapsed?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = theme ?? "system";
  const currentLabel =
    currentTheme === "system"
      ? `Sistema (${resolvedTheme === "dark" ? "oscuro" : "claro"})`
      : currentTheme === "dark"
        ? "Modo oscuro"
        : "Modo claro";

  if (collapsed) {
    return (
      <div className="rounded-[1.05rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
        <div className="grid gap-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = currentTheme === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cx(
                  "inline-flex h-9 w-full items-center justify-center rounded-[0.9rem] transition focus-visible:outline-none",
                  active
                    ? "border border-[color:color-mix(in_srgb,var(--primary)_28%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_92%,white),color-mix(in_srgb,var(--primary-strong)_92%,black))] text-[color:var(--primary-contrast)] shadow-[0_10px_18px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                    : "text-[color:var(--color-text-soft)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--color-text)]",
                )}
                aria-pressed={active}
                aria-label={`Activar tema ${label.toLowerCase()}`}
                title={`Tema: ${label}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Tema</div>
        {!dense ? <div className="truncate text-[11px] font-medium text-[color:var(--color-text-muted)]">{currentLabel}</div> : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = currentTheme === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cx(
                "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[0.9rem] px-2 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none",
                active
                  ? "border border-[color:color-mix(in_srgb,var(--primary)_28%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_92%,white),color-mix(in_srgb,var(--primary-strong)_92%,black))] text-[color:var(--primary-contrast)] shadow-[0_10px_18px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                  : "text-[color:var(--color-text-soft)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--color-text)]",
              )}
              aria-pressed={active}
              aria-label={`Activar tema ${label.toLowerCase()}`}
              title={`Cambiar a ${label.toLowerCase()}`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
              {!dense ? <span className="hidden xl:inline">{label}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = useMemo(() => {
    const full = `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim();
    return full || me?.username || "Administrador";
  }, [me?.first_name, me?.last_name, me?.username]);

  const nav = useMemo(() => {
    const base = [
      { href: "/admin/inicio", label: "Inicio", icon: <IconHome className="h-4 w-4" /> },
      { href: "/admin/usuarios", label: "Usuarios", icon: <IconUser className="h-4 w-4" /> },
      { href: "/admin/equipos", label: "Equipos", icon: <IconLaptop className="h-4 w-4" /> },
      { href: "/admin/accesos", label: "Accesos", icon: <IconHistory className="h-4 w-4" /> },
      { href: "/admin/turnos", label: "Turnos", icon: <IconClock className="h-4 w-4" /> },
    ];

    if (me?.rol === "superadmin") {
      base.push({
        href: "/admin/control-center",
        label: "Centro de control",
        icon: <IconShield className="h-4 w-4" />,
      });
    }

    return base;
  }, [me?.rol]);

  async function handleLogout() {
    await logoutCurrentSession(router);
  }

  const desktopExpanded = !collapsed || hovered;
  const shellOffset = desktopExpanded ? "lg:pl-[15.25rem]" : "lg:pl-[5.5rem]";

  return (
    <div className="sadi-shell relative min-h-dvh overflow-x-hidden">
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        data-collapsed={desktopExpanded ? "false" : "true"}
        className="sadi-sidebar fixed inset-y-0 left-0 z-50 hidden border-r border-[color:var(--color-border)] bg-[color:var(--sidebar-bg)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] transition-[width,box-shadow] duration-300 lg:flex lg:flex-col"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={cx("flex items-center border-b border-[color:var(--color-border)] py-3", desktopExpanded ? "justify-between px-3" : "justify-center px-2.5")}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[1.1rem] border border-[color:var(--color-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_10%,white),color-mix(in_srgb,var(--surface-subtle)_96%,transparent))] text-[color:var(--color-primary)] shadow-[0_12px_22px_rgba(15,23,42,0.08)]">
              <span className="text-sm font-black tracking-[0.18em]">SA</span>
            </div>
            {desktopExpanded ? (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">SADI</div>
                <div className="truncate text-[0.98rem] font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Administracion</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden h-9 w-9 items-center justify-center rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)] lg:inline-flex"
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>

        <div className={cx("flex min-h-0 flex-1 flex-col py-3", desktopExpanded ? "px-3" : "px-2.5")}>
          {desktopExpanded ? (
            <div className="mb-3 overflow-hidden rounded-[1.3rem] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-bg)_100%,white),color-mix(in_srgb,var(--surface)_82%,transparent))] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Contexto</div>
                <span className="command-noir-chip" data-tone="info">Admin</span>
              </div>
              <div className="mt-2.5 text-[0.95rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text)]">Gestión institucional</div>
              <div className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-text-muted)]">
                Usuarios, accesos y turnos con una navegación más clara y ejecutiva.
              </div>
            </div>
          ) : null}

          {desktopExpanded ? <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Navegacion</div> : null}
          <nav className={cx("space-y-1.5", desktopExpanded ? "" : "px-0.5")}>
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <div key={`desktop-${item.href}`} onClick={() => setMobileOpen(false)}>
                  <SidebarItem
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    collapsed={!desktopExpanded}
                  />
                </div>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-[color:var(--color-border)] pt-3">
            {desktopExpanded ? (
              <div className="sadi-card rounded-[1.25rem] px-3 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[1rem] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_12%,white),color-mix(in_srgb,var(--surface-subtle)_92%,transparent))] text-sm font-semibold text-[color:var(--primary-strong)]">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[color:var(--color-text)]">{loadingMe ? "Cargando..." : displayName}</div>
                    <div className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">{loadingMe ? "" : `${me?.rol ?? "admin"}`}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/perfil")}
                    className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-2.5 py-2 text-xs font-semibold text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)]"
                  >
                    Ver perfil
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,var(--danger)_28%,var(--color-border))] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] px-2.5 py-2 text-xs font-semibold text-[color:var(--danger)] transition hover:brightness-105"
                  >
                    <IconLogout className="h-3.5 w-3.5" />
                    Salir
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => router.push("/admin/perfil")}
                  className="group flex w-full items-center justify-center rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] p-2.5 transition hover:border-[color:var(--color-border-strong)]"
                  aria-label="Ir a perfil"
                  title="Mi perfil"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-[0.95rem] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_12%,white),color-mix(in_srgb,var(--surface-subtle)_92%,transparent))] text-sm font-semibold text-[color:var(--primary-strong)]">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                </button>
                <ThemeSwitcher collapsed />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-[1.05rem] border border-[color:color-mix(in_srgb,var(--danger)_28%,var(--color-border))] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] px-3 py-2.5 text-xs font-semibold text-[color:var(--danger)] transition hover:brightness-105"
                  aria-label="Cerrar sesion"
                  title="Cerrar sesion"
                >
                  <IconLogout className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {desktopExpanded ? <ThemeSwitcher dense={false} /> : null}

            <div className={cx("text-[11px] text-[color:var(--color-text-muted)]", desktopExpanded ? "" : "text-center")}>SADI · 2026</div>
          </div>
        </div>
      </aside>

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-[19rem] border-r border-[color:var(--color-border)] bg-[color:var(--sidebar-bg)] shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">SADI</div>
              <div className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Administración</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-soft)]"
            >
              Cerrar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 sadi-card rounded-[1.35rem] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Sesión actual</div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">{loadingMe ? "Cargando..." : displayName || "Administrador"}</div>
              <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
            </div>
            <div className="mb-3">
              <ThemeSwitcher />
            </div>

            <nav className="space-y-1.5">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <div key={`mobile-${item.href}`} onClick={() => setMobileOpen(false)}>
                    <SidebarItem href={item.href} label={item.label} icon={item.icon} active={active} />
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-[color:var(--color-border)] p-3">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                router.push("/admin/perfil");
              }}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm font-semibold text-[color:var(--color-text-soft)]"
            >
              <IconUser className="h-4 w-4" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:color-mix(in_srgb,var(--danger)_28%,var(--color-border))] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-subtle))] px-4 py-3 text-sm font-semibold text-[color:var(--danger)] transition hover:brightness-105"
            >
              <IconLogout className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

        <div className={cx("sadi-shell-content min-h-dvh transition-[padding-left] duration-300", shellOffset)}>
         <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col px-2.5 py-2.5 sm:px-3.5 lg:px-4 lg:py-3 xl:px-5">
           <div className="mb-2.5 flex items-center justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">SADI</div>
               <h1 className="truncate text-base font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Panel administrativo</h1>
              <p className="truncate text-xs text-[color:var(--color-text-muted)]">{loadingMe ? "Cargando..." : displayName || "Administrador"}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
               className="rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--surface)] px-3.5 py-2.5 text-sm font-semibold text-[color:var(--color-text-soft)] shadow-[0_16px_32px_rgba(0,0,0,0.12)]"
            >
              Menú
            </button>
          </div>

          <main className="min-w-0">
            <div className="animate-[fadeIn_.28s_cubic-bezier(0.22,1,0.36,1)]">{children}</div>
          </main>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
