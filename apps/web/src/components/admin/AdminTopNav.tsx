"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useMe } from "@/hooks/useMe";
import { clearTokens } from "@/lib/auth";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AdminTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();

  function logout() {
    clearTokens();
    router.replace("/login");
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
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm">SADI</div>
          <nav className="hidden items-center gap-1 rounded-2xl border border-surface-border bg-surface p-1 shadow-sm md:flex">
            {tabs.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cx(
                    "rounded-xl px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    active ? "bg-primary text-white shadow-sm" : "text-text/80 hover:bg-primary/10 hover:text-primary"
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
            <div className="text-sm font-semibold text-text">{loadingMe ? "Cargando..." : nombreBonito || "-"}</div>
            <div className="text-xs text-text/70">{loadingMe ? "" : me?.rol ?? ""}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl gap-1 px-4 pb-2 md:hidden sm:px-6">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "flex-1 rounded-lg px-2 py-1 text-center text-xs font-semibold transition",
                active ? "bg-primary text-white" : "bg-surface text-text/80"
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
