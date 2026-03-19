"use client";

import { usePathname, useRouter } from "next/navigation";

import SidebarItem from "@/components/aprendiz/dashboard/SidebarItem";
import { IconClock, IconHistory, IconLaptop, IconLogout, IconUser } from "@/components/aprendiz/dashboard/DashboardIcons";
import { useMe } from "@/hooks/useMe";
import { logoutCurrentSession } from "@/lib/logout";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();

  async function logout() {
    await logoutCurrentSession(router);
  }

  const nombreBonito =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  const nav = [
    { href: "/admin/usuarios", label: "Usuarios", icon: <IconUser className="h-4 w-4" /> },
    { href: "/admin/equipos", label: "Equipos", icon: <IconLaptop className="h-4 w-4" /> },
    { href: "/admin/accesos", label: "Accesos", icon: <IconHistory className="h-4 w-4" /> },
    { href: "/admin/turnos", label: "Turnos", icon: <IconClock className="h-4 w-4" /> },
    ...(me?.rol === "superadmin"
      ? [{ href: "/admin/control-center", label: "Centro de control", icon: <IconUser className="h-4 w-4" /> }]
      : []),
  ] as const;

  return (
    <div className="sadi-shell w-full overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:gap-5">
        <aside className="sadi-card sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-[1.9rem] p-5 lg:flex lg:flex-col xl:w-[17rem]">
          <div className="mb-6">
            <div className="sadi-kicker text-xs font-semibold">SADI</div>
            <div className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Panel administrativo</div>
            <div className="mt-1 text-xs sadi-text-muted">Operación centralizada por sede, permisos y trazabilidad.</div>
          </div>

          <div className="sadi-subtle-panel mb-5 rounded-2xl p-4">
            <div className="sadi-kicker text-xs font-semibold tracking-wide">Sesión actual</div>
            <div className="mt-1 text-xs sadi-text-muted">Gestiona usuarios, equipos, accesos y turnos desde un solo lugar.</div>
            <div className="mt-3 truncate text-sm font-semibold text-foreground">{loadingMe ? "Cargando..." : nombreBonito || "Administrador"}</div>
            <div className="mt-1 text-xs sadi-text-faint">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
          </div>

          <nav className="space-y-1.5">
            {nav.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return <SidebarItem key={it.href + it.label} href={it.href} label={it.label} icon={it.icon} active={active} />;
            })}
          </nav>

          <div className="mt-auto border-t border-surface-border pt-4">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-surface-border bg-surface-muted px-4 py-3 text-sm font-semibold sadi-text-soft transition hover:border-[color:var(--surface-border-strong)] hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none"
            >
              <IconLogout className="h-4 w-4" />
              Cerrar sesión
            </button>
            <div className="mt-4 text-xs sadi-text-faint">SADI © 2026</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-5 pt-1">
          <div className="space-y-3 lg:hidden">
            <div className="sadi-card-strong rounded-[1.6rem] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="sadi-kicker text-[10px] font-semibold">SADI</div>
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">Panel administrativo</h1>
                  <p className="truncate text-xs sadi-text-muted">{loadingMe ? "Cargando..." : nombreBonito || "Administrador"}</p>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1.5 text-xs font-semibold sadi-text-soft transition hover:border-[color:var(--surface-border-strong)] hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none"
                >
                  <IconLogout className="h-3.5 w-3.5" />
                  Salir
                </button>
              </div>
              <div className="mt-3 text-xs sadi-text-faint">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
            </div>

            <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {nav.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <SidebarItem
                    key={`mobile-${it.href}`}
                    href={it.href}
                    label={it.label}
                    icon={it.icon}
                    active={active}
                  />
                );
              })}
            </nav>
          </div>

          <main className="min-w-0">
            <div className="animate-[fadeIn_280ms_ease-out]">{children}</div>
          </main>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
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
