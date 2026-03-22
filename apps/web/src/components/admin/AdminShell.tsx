"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import SidebarItem from "@/components/aprendiz/dashboard/SidebarItem";
import {
  IconBell,
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();
  const [collapsed, setCollapsed] = useState(false);
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

  const shellOffset = collapsed ? "lg:pl-[7rem]" : "lg:pl-[19rem]";

  return (
    <div className="sadi-shell relative min-h-screen overflow-x-hidden">
      {mobileOpen ? (
        <button
          aria-label="Cerrar navegaci?n"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 hidden border-r border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(6,10,16,0.98),rgba(10,16,24,0.94))] shadow-[0_18px_60px_rgba(0,0,0,0.34)] transition-all duration-300 lg:flex lg:flex-col",
          collapsed ? "w-[7rem]" : "w-[19rem]",
        )}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[1.2rem] border border-[color:var(--color-border-strong)] bg-[linear-gradient(180deg,rgba(111,211,255,0.18),rgba(255,255,255,0.03))] text-[color:var(--color-primary)] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <span className="text-sm font-black tracking-[0.18em]">SA</span>
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">SADI</div>
                <div className="truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Command Centre</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.03)] text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)] lg:inline-flex"
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          >
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <div className="sadi-card rounded-[1.6rem] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.04)] text-[color:var(--color-primary)]">
                <IconBell className="h-4 w-4" />
              </div>
              <span className="command-noir-chip" data-tone="info">
                Operaci?n
              </span>
            </div>
            {!collapsed ? (
              <>
                <div className="mt-4 text-sm font-semibold text-[color:var(--color-text)]">Control premium de accesos y operaci?n.</div>
                <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  Navega por usuarios, trazabilidad y turnos con una vista clara, sobria y enfocada.
                </div>
              </>
            ) : null}
          </div>

          <nav className="mt-4 space-y-1.5">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <div key={`desktop-${item.href}`} onClick={() => setMobileOpen(false)}>
                  <SidebarItem
                    href={item.href}
                    label={collapsed ? item.label.slice(0, 12) : item.label}
                    icon={item.icon}
                    active={active}
                  />
                </div>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-[color:var(--color-border)] pt-3">
            <div className="sadi-card rounded-[1.4rem] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Mi perfil</div>
              <div className="mt-2 truncate text-sm font-semibold text-[color:var(--color-text)]">{loadingMe ? "Cargando..." : displayName}</div>
              <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
              {!collapsed ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/perfil")}
                    className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-soft)] transition hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)]"
                  >
                    Ver perfil
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[color:rgba(255,107,122,0.28)] bg-[rgba(255,107,122,0.08)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)] transition hover:brightness-110"
                  >
                    <IconLogout className="h-3.5 w-3.5" />
                    Salir
                  </button>
                </div>
              ) : null}
            </div>

            {collapsed ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:rgba(255,107,122,0.28)] bg-[rgba(255,107,122,0.08)] px-4 py-3 text-xs font-semibold text-[color:var(--danger)] transition hover:brightness-110"
              >
                <IconLogout className="h-3.5 w-3.5" />
              </button>
            ) : null}

            <div className="text-[11px] text-[color:var(--color-text-muted)]">SADI ? 2026</div>
          </div>
        </div>
      </aside>

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-[19rem] border-r border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(6,10,16,0.98),rgba(10,16,24,0.94))] shadow-[0_18px_60px_rgba(0,0,0,0.34)] transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">SADI</div>
              <div className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Command Centre</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-soft)]"
            >
              Cerrar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 sadi-card rounded-[1.4rem] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Sesi?n actual</div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">{loadingMe ? "Cargando..." : displayName || "Administrador"}</div>
              <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
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
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-3 text-sm font-semibold text-[color:var(--color-text-soft)]"
            >
              <IconUser className="h-4 w-4" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:rgba(255,107,122,0.28)] bg-[rgba(255,107,122,0.08)] px-4 py-3 text-sm font-semibold text-[color:var(--danger)] transition hover:brightness-110"
            >
              <IconLogout className="h-4 w-4" />
              Cerrar sesi?n
            </button>
          </div>
        </div>
      </aside>

      <div className={cx("min-h-screen", shellOffset)}>
        <div className="mx-auto flex w-full max-w-none flex-col px-4 py-4 sm:px-6 lg:px-6 lg:py-5">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">SADI</div>
              <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--color-text)]">Panel administrativo</h1>
              <p className="truncate text-xs text-[color:var(--color-text-muted)]">{loadingMe ? "Cargando..." : displayName || "Administrador"}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:rgba(255,255,255,0.04)] px-4 py-3 text-sm font-semibold text-[color:var(--color-text-soft)] shadow-[0_16px_32px_rgba(0,0,0,0.18)]"
            >
              Men?
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
