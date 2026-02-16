"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearTokens } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/useMe";

type EstadoResponse = {
  estado?: "DENTRO" | "FUERA" | "SIN_REGISTROS";
  ultimo_tipo?: "ingreso" | "salida" | null;
  ultima_fecha?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function estadoBadge(estado?: string) {
  const base = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold";
  if (estado === "DENTRO") return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
  if (estado === "FUERA") return `${base} bg-sky-50 text-sky-800 border-sky-200`;
  return `${base} bg-zinc-100 text-zinc-700 border-zinc-200`;
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

  const nombreBonito =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  const nav = [
    { href: "/aprendiz/inicio", label: "Inicio" },
    { href: "/aprendiz/equipos", label: "Mis equipos" },
    { href: "/aprendiz/accesos", label: "Historial" },
    { href: "/aprendiz/mi-qr", label: "Mi QR" },
    { href: "/aprendiz/perfil", label: "Mi perfil" },
    { href: "/aprendiz/ayuda", label: "Ayuda" },
  ] as const;

  return (
    <div className="min-h-screen w-full bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        {/* SIDEBAR */}
        <aside className="hidden w-72 shrink-0 rounded-3xl border bg-white p-5 shadow-sm lg:block">
          <div className="mb-6">
            <div className="text-xs font-semibold tracking-wide text-emerald-700">
              SENA
            </div>
            <div className="text-lg font-extrabold tracking-tight text-zinc-900">
              AccesoSEN
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Sistema de Control de Acceso
            </div>
          </div>

          <div className="mb-5 rounded-2xl border bg-zinc-50 p-4">
            <div className="text-xs text-zinc-500">Bienvenido/a</div>
            <div className="mt-1 font-semibold text-zinc-900">
              {loadingMe ? "Cargando..." : nombreBonito || "—"}
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              {loadingMe ? "" : me?.programa_formacion ?? ""}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={estadoBadge(estado?.estado)}>
                <span
                  className={cx(
                    "inline-block h-2 w-2 rounded-full",
                    estado?.estado === "DENTRO" && "bg-emerald-600",
                    estado?.estado === "FUERA" && "bg-sky-600",
                    (!estado?.estado || estado?.estado === "SIN_REGISTROS") &&
                      "bg-zinc-400"
                  )}
                />
                {estado?.estado ?? "SIN REGISTROS"}
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            {nav.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cx(
                    "block rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t pt-4">
            <button
              onClick={logout}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cerrar sesión
            </button>
          </div>

          <div className="mt-5 text-xs text-zinc-400">SENA Tunja • 2025</div>
        </aside>

        {/* MAIN */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* TOPBAR */}
          <div className="flex flex-col gap-3 rounded-3xl border bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide text-emerald-700">
                Aprendiz
              </div>
              <h1 className="truncate text-xl font-extrabold tracking-tight text-zinc-900">
                {title}
              </h1>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="text-sm font-semibold text-zinc-900">
                {loadingMe ? "" : nombreBonito}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={estadoBadge(estado?.estado)}>
                  <span
                    className={cx(
                      "inline-block h-2 w-2 rounded-full",
                      estado?.estado === "DENTRO" && "bg-emerald-600",
                      estado?.estado === "FUERA" && "bg-sky-600",
                      (!estado?.estado || estado?.estado === "SIN_REGISTROS") &&
                        "bg-zinc-400"
                    )}
                  />
                  {estado?.estado ?? "SIN REGISTROS"}
                </span>

                <button
                  onClick={logout}
                  className="rounded-full border px-4 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 lg:hidden"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
