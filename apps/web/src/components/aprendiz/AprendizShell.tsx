"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";
import { logoutCurrentSession } from "@/lib/logout";
import SidebarItem from "./dashboard/SidebarItem";
import StatusChip from "./dashboard/StatusChip";
import {
  IconHelp,
  IconHistory,
  IconHome,
  IconLaptop,
  IconLogout,
  IconQr,
  IconRefresh,
  IconUser,
} from "./dashboard/DashboardIcons";

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS";
  ultimo_tipo?: "ingreso" | "salida" | null;
  ultima_fecha?: string | null;
};

function prettyTitle(pathname: string) {
  const p = pathname.split("?")[0];
  if (p === "/aprendiz" || p === "/aprendiz/inicio") return "Panel aprendiz";
  if (p.startsWith("/aprendiz/equipos/nuevo")) return "Registrar equipo";
  if (p.startsWith("/aprendiz/equipos/")) return "Detalle del equipo";
  if (p.startsWith("/aprendiz/equipos")) return "Mis equipos";
  if (p.startsWith("/aprendiz/accesos")) return "Historial de ingresos";
  if (p.startsWith("/aprendiz/mi-qr")) return "Mi QR";
  if (p.startsWith("/aprendiz/perfil")) return "Mi perfil";
  if (p.startsWith("/aprendiz/primer-acceso")) return "Primer acceso";
  if (p.startsWith("/aprendiz/ayuda")) return "Ayuda y soporte";
  if (p.startsWith("/aprendiz/estado")) return "Estado";
  return "Aprendiz";
}

export default function AprendizShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();
  const [estado, setEstado] = useState<EstadoResponse | null>(null);

  const title = useMemo(() => prettyTitle(pathname), [pathname]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const res = await api.get<EstadoResponse>("/api/accesos/estado/");
        if (mounted) setEstado(res.data);
      } catch {
        if (mounted) setEstado(null);
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await logoutCurrentSession(router);
  }

  function refreshPanel() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aprendiz:refresh"));
    }
    router.refresh();
  }

  const nombreBonito =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  const nav = [
    { href: "/aprendiz/inicio", label: "Inicio", icon: <IconHome className="h-4 w-4" /> },
    { href: "/aprendiz/equipos", label: "Mis equipos", icon: <IconLaptop className="h-4 w-4" /> },
    { href: "/aprendiz/accesos", label: "Historial", icon: <IconHistory className="h-4 w-4" /> },
    { href: "/aprendiz/mi-qr", label: "Mi QR", icon: <IconQr className="h-4 w-4" /> },
    { href: "/aprendiz/perfil", label: "Mi perfil", icon: <IconUser className="h-4 w-4" /> },
    { href: "/aprendiz/ayuda", label: "Ayuda", icon: <IconHelp className="h-4 w-4" /> },
  ] as const;

  const isPrimerAcceso = pathname.startsWith("/aprendiz/primer-acceso");

  return (
    <div className="sadi-shell w-full overflow-x-hidden">
      {isPrimerAcceso ? (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
          <div className="sadi-card mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <div className="sadi-kicker text-xs font-semibold">SADI</div>
              <p className="truncate text-sm sadi-text-muted">{loadingMe ? "Cargando perfil..." : `Hola, ${nombreBonito || "Aprendiz"}`}</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1.5 text-xs font-semibold sadi-text-soft transition hover:border-[color:var(--surface-border-strong)] hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none"
            >
              <IconLogout className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
          <main className="min-w-0">
            <div className="animate-[fadeIn_280ms_ease-out]">{children}</div>
          </main>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:gap-5">
          <aside className="sadi-card sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-[1.9rem] p-5 lg:flex lg:flex-col xl:w-[17rem]">
            <div className="mb-6">
              <div className="sadi-kicker text-xs font-semibold">SADI</div>
              <div className="mt-1 text-lg font-extrabold tracking-tight text-foreground">Portal del aprendiz</div>
              <div className="mt-1 text-xs sadi-text-muted">Accede a tu QR, historial y gestión de equipos con claridad.</div>
            </div>

            <div className="sadi-subtle-panel mb-5 rounded-2xl p-4">
              <div className="sadi-kicker text-xs font-semibold tracking-wide">Estado de acceso</div>
              <div className="mt-1 text-xs sadi-text-muted">Consulta rápida de tu estado actual en portería.</div>
              <div className="mt-3">
                <StatusChip status={estado?.estado} />
              </div>
              <div className="mt-3 truncate text-xs sadi-text-faint">
                {loadingMe ? "Cargando..." : me?.documento ? `ID: ${me.documento}` : "ID no registrado"}
              </div>
            </div>

            <nav className="space-y-1.5">
              {nav.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return <SidebarItem key={it.href} href={it.href} label={it.label} icon={it.icon} active={active} />;
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

          <div className="flex min-w-0 flex-1 flex-col gap-4 pb-5">
            <div className="sadi-card-strong sticky top-4 z-20 rounded-[1.75rem] px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="sadi-kicker text-xs font-semibold">Panel aprendiz</div>
                  <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{title}</h1>
                  <p className="truncate text-xs sadi-text-muted">{loadingMe ? "Cargando perfil..." : `Hola, ${nombreBonito || "Aprendiz"}`}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusChip status={estado?.estado} />
                  <button
                    onClick={refreshPanel}
                    className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1.5 text-xs font-semibold sadi-text-soft transition hover:border-[color:var(--surface-border-strong)] hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none"
                  >
                    <IconRefresh className="h-3.5 w-3.5" />
                    Recargar
                  </button>
                  <button
                    onClick={logout}
                    className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-muted px-3 py-1.5 text-xs font-semibold sadi-text-soft transition hover:border-[color:var(--surface-border-strong)] hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none lg:hidden"
                  >
                    <IconLogout className="h-3.5 w-3.5" />
                    Salir
                  </button>
                </div>
              </div>
            </div>

            <main className="min-w-0">
              <div className="animate-[fadeIn_280ms_ease-out]">{children}</div>
            </main>
          </div>
        </div>
      )}

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
