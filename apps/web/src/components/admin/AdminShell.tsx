"use client";

import { usePathname, useRouter } from "next/navigation";

import SidebarItem from "@/components/aprendiz/dashboard/SidebarItem";
import { IconClock, IconHistory, IconLaptop, IconLogout, IconUser } from "@/components/aprendiz/dashboard/DashboardIcons";
import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();

  async function logout() {
    try {
      await api.post(
        "/api/auth/logout-all/",
        { auth_transport: "cookie" },
        { headers: { "X-Auth-Transport": "cookie" } }
      );
    } catch {
      // Best effort revocation.
    }
    clearTokens();
    router.replace("/login");
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
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-sky-50/70 via-cyan-50/35 to-zinc-100/70">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:gap-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-3xl border border-white/65 bg-white/65 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.08)] backdrop-blur-xl lg:flex lg:flex-col xl:w-[17rem]">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">SADI</div>
            <div className="text-lg font-extrabold tracking-tight text-zinc-900">Panel administrativo</div>
            <div className="mt-1 text-xs text-zinc-500">Operación centralizada por sede y por rol.</div>
          </div>

          <div className="mb-5 rounded-2xl border border-sky-100/90 bg-gradient-to-br from-sky-50/70 to-cyan-50/55 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Sesión actual</div>
            <div className="mt-1 text-xs text-zinc-600">Gestiona usuarios, equipos, accesos y turnos desde un solo lugar.</div>
            <div className="mt-3 truncate text-sm font-semibold text-zinc-900">
              {loadingMe ? "Cargando..." : nombreBonito || "Administrador"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">{loadingMe ? "" : `Rol: ${me?.rol ?? "admin"}`}</div>
          </div>

          <nav className="space-y-1.5">
            {nav.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <SidebarItem
                  key={it.href + it.label}
                  href={it.href}
                  label={it.label}
                  icon={it.icon}
                  active={active}
                />
              );
            })}
          </nav>

          <div className="mt-auto border-t border-zinc-200/75 pt-4">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              <IconLogout className="h-4 w-4" />
              Cerrar sesión
            </button>
            <div className="mt-4 text-xs text-zinc-400">SADI © 2026</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-5 pt-1">
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
