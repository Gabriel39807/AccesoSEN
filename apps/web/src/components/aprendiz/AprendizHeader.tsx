"use client";

import { useRouter } from "next/navigation";

import { useMe } from "@/hooks/useMe";
import { logoutCurrentSession } from "@/lib/logout";

export default function AprendizHeader() {
  const router = useRouter();
  const { me, loadingMe } = useMe();

  const nombre =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  async function logout() {
    await logoutCurrentSession(router);
  }

  return (
    <div className="sticky top-0 z-10 border-b border-surface-border bg-[color:color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-xl">
      <div className="mx-auto max-w-md px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[color:var(--text-muted)]">Panel aprendiz</p>
            <p className="text-lg font-semibold leading-tight text-foreground">{loadingMe ? "Cargando..." : nombre || "-"}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-surface-border bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-muted)] hover:text-foreground"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
