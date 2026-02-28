"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { useMe } from "@/hooks/useMe";

export default function AprendizHeader() {
  const router = useRouter();
  const { me, loadingMe } = useMe();

  const nombre =
    me?.first_name || me?.last_name
      ? `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim()
      : me?.username ?? "";

  async function logout() {
    try {
      await api.post(
        "/api/auth/logout-all/",
        { auth_transport: "cookie" },
        { headers: { "X-Auth-Transport": "cookie" } }
      );
    } catch {
      // best effort revocation
    }
    clearTokens();
    router.replace("/login");
  }

  return (
    <div className="sticky top-0 z-10 bg-gray-100">
      <div className="mx-auto max-w-md px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Panel Aprendiz</p>
            <p className="text-lg font-semibold leading-tight">
              {loadingMe ? "Cargando..." : nombre || "—"}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm border rounded-lg px-3 py-2 bg-white hover:bg-gray-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
