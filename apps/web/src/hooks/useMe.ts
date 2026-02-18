"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type MeUser = {
  id: number;
  username: string;
  rol: "superadmin" | "admin_sede" | "aprendiz" | "guarda";
  first_name?: string;
  last_name?: string;
  email?: string;
  documento?: string | null;
  must_change_password?: boolean;
  estado?: "activo" | "bloqueado" | string;
  sede_principal?: string | null;
  programa_formacion?: string | null;
};

type MeResponse = {
  permitido: boolean;
  motivo: string | null;
  usuario: MeUser;
};

export function useMe() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const res = await api.get<MeResponse>("/api/me/");
        if (mounted) setMe(res.data.usuario);
      } catch {
        if (mounted) setMe(null);
      } finally {
        if (mounted) setLoadingMe(false);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return { me, loadingMe };
}
