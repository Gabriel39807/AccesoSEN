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
    <div className="sticky top-0 z-10 bg-gray-100">
      <div className="mx-auto max-w-md px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Panel aprendiz</p>
            <p className="text-lg font-semibold leading-tight">
              {loadingMe ? "Cargando..." : nombre || "-"}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
