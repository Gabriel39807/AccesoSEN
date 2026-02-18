"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useMe } from "@/hooks/useMe";
import { clearTokens } from "@/lib/auth";
import { api } from "@/lib/api";
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
import SidebarItem from "./dashboard/SidebarItem";
import StatusChip from "./dashboard/StatusChip";

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS";
  ultimo_tipo?: "ingreso" | "salida" | null;
  ultima_fecha?: string | null;
};

function prettyTitle(pathname: string) {
  const p = pathname.split("?")[0];
  if (p === "/aprendiz" || p === "/aprendiz/inicio") return "Panel Aprendiz";
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
    run();
    return () => {
      mounted = false;
    };
  }, []);

  function logout() {
    clearTokens();
    router.replace("/login");
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

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-sky-50/70 via-cyan-50/35 to-zinc-100/70">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:gap-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 rounded-3xl border border-white/65 bg-white/65 p-5 shadow-[0_10px_30px_rgba(2,6,23,0.08)] backdrop-blur-xl lg:flex lg:flex-col xl:w-[17rem]">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">SENA</div>
            <div className="text-lg font-extrabold tracking-tight text-zinc-900">AccesoSEN</div>
            <div className="mt-1 text-xs text-zinc-500">Sistema de Control de Acceso</div>
          </div>

          <div className="mb-5 rounded-2xl border border-sky-100/90 bg-gradient-to-br from-sky-50/70 to-cyan-50/55 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Estado de acceso</div>
            <div className="mt-1 text-xs text-zinc-600">Consulta rapida de tu estado actual en porteria.</div>
            <div className="mt-3">
              <StatusChip status={estado?.estado} />
            </div>
            <div className="mt-3 truncate text-xs text-zinc-500">
              {loadingMe ? "Cargando..." : me?.documento ? `ID: ${me.documento}` : "ID no registrado"}
            </div>
          </div>

          <nav className="space-y-1.5">
            {nav.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return <SidebarItem key={it.href} href={it.href} label={it.label} icon={it.icon} active={active} />;
            })}
          </nav>

          <div className="mt-auto border-t border-zinc-200/75 pt-4">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              <IconLogout className="h-4 w-4" />
              Cerrar sesion
            </button>
            <div className="mt-4 text-xs text-zinc-400">SENA Tunja - 2025</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-5">
          <div className="sticky top-4 z-20 rounded-3xl border border-white/70 bg-white/72 px-4 py-4 shadow-[0_8px_30px_rgba(2,6,23,0.08)] backdrop-blur-xl sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Panel Aprendiz</div>
                <h1 className="truncate text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
                <p className="truncate text-xs text-zinc-500">
                  {loadingMe ? "Cargando perfil..." : `Hola, ${nombreBonito || "Aprendiz"}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <StatusChip status={estado?.estado} />
                <button
                  onClick={refreshPanel}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                >
                  <IconRefresh className="h-3.5 w-3.5" />
                  Recargar
                </button>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 lg:hidden"
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

