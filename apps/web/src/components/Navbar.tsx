"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearTokens } from "@/lib/auth";
import { useMe } from "@/hooks/useMe";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loadingMe } = useMe();

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  const isAdmin = pathname.startsWith("/admin");
  const isAprendiz = pathname.startsWith("/aprendiz");
  const badgeClass = isAprendiz
    ? "from-sky-700 to-cyan-600"
    : "from-teal-700 to-emerald-600";

  const nombreBonito =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <span className={`rounded-xl bg-gradient-to-r ${badgeClass} px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm`}>
            SADI
          </span>

          {isAdmin && (
            <div className="flex items-center gap-1 text-sm">
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/admin/usuarios">
                Usuarios
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/admin/equipos">
                Equipos
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/admin/accesos">
                Accesos
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/admin/turnos">
                Turnos
              </Link>
            </div>
          )}

          {isAprendiz && (
            <div className="flex items-center gap-1 text-sm">
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/aprendiz/inicio">
                Inicio
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/aprendiz/equipos">
                Mis equipos
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/aprendiz/accesos">
                Historial
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/aprendiz/perfil">
                Mi perfil
              </Link>
              <Link className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100" href="/aprendiz/ayuda">
                Ayuda
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold text-slate-900">
              {loadingMe ? "Cargando..." : nombreBonito || "—"}
            </div>
            <div className="text-xs text-slate-500">{loadingMe ? "" : me?.rol ?? ""}</div>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
