"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useMe } from "@/hooks/useMe";
import { logoutCurrentSession } from "@/lib/logout";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AdminTopNav() {
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

  const tabs = [
    { href: "/admin/usuarios", label: "Usuarios" },
    { href: "/admin/equipos", label: "Equipos" },
    { href: "/admin/accesos", label: "Accesos" },
    { href: "/admin/turnos", label: "Turnos" },
    ...(me?.rol === "superadmin" ? [{ href: "/admin/control-center", label: "Centro de control" }] : []),
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm shadow-emerald-900/20">
            SADI
          </div>
          <nav className="hidden items-center gap-1 rounded-2xl border border-zinc-200/80 bg-white/95 p-1 shadow-sm md:flex">
            {tabs.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cx(
                    "rounded-xl px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                    active
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-900/20"
                      : "text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold text-zinc-900">{loadingMe ? "Cargando..." : nombreBonito || "-"}</div>
            <div className="text-xs text-zinc-500">{loadingMe ? "" : me?.rol ?? ""}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl gap-1 px-4 pb-2 sm:px-6 md:hidden">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "flex-1 rounded-lg px-2 py-1 text-center text-xs font-semibold transition",
                active ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white" : "bg-white text-zinc-700"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
