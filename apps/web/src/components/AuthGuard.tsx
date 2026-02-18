"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";

type MeResponse = {
  permitido: boolean;
  motivo: string | null;
  usuario: {
    id: number;
    username: string;
    rol: "superadmin" | "admin_sede" | "aprendiz" | "guarda";
    must_change_password?: boolean;
  };
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      try {
        const me = await api.get<MeResponse>("/api/me/");
        const rol = me.data.usuario.rol;

        const isAdminRoute = pathname.startsWith("/admin");
        const isAprendizRoute = pathname.startsWith("/aprendiz");
        const isPrimerAcceso = pathname.startsWith("/aprendiz/primer-acceso");

        if (rol === "aprendiz" && me.data.usuario.must_change_password && !isPrimerAcceso) {
          router.replace("/aprendiz/primer-acceso");
          return;
        }
        if (rol === "aprendiz" && !me.data.usuario.must_change_password && isPrimerAcceso) {
          router.replace("/aprendiz/inicio");
          return;
        }

        // Protecciones:
        if (isAdminRoute && !["superadmin", "admin_sede"].includes(rol)) {
          router.replace("/aprendiz/inicio");
          return;
        }
        if (isAprendizRoute && rol !== "aprendiz") {
          router.replace("/admin/usuarios");
          return;
        }

        // Si está en login y ya está autenticado, redirige
        if (pathname === "/login") {
          if (["superadmin", "admin_sede"].includes(rol)) router.replace("/admin/usuarios");
          else if (rol === "aprendiz") router.replace("/aprendiz/inicio");
          else router.replace("/login");
          return;
        }

        setLoading(false);
      } catch (e) {
        // no autenticado / token vencido
        clearTokens();
        router.replace("/login");
      }
    }

    run();
  }, [pathname, router]);

  // Mientras valida /api/me/
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Validando sesión...</p>
      </div>
    );
  }

  return <>{children}</>;
}
