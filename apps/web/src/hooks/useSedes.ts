"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type SedeItem = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type UseSedesOptions = {
  includeInactive?: boolean;
};

export function useSedes(options?: UseSedesOptions) {
  const includeInactive = Boolean(options?.includeInactive);
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadSedes = () => setReloadToken((v) => v + 1);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const params = includeInactive ? { include_inactive: "true" } : { active: "true" };
        const res = await api.get<SedeItem[] | Paginated<SedeItem>>("/api/sedes/", { params });
        const rows = Array.isArray(res.data) ? res.data : (res.data as Paginated<SedeItem>).results ?? [];
        if (mounted) setSedes(rows);
      } catch {
        if (mounted) setSedes([]);
      } finally {
        if (mounted) setLoadingSedes(false);
      }
    }
    run();

    function onUpdated() {
      if (!mounted) return;
      setReloadToken((v) => v + 1);
    }
    function onVisibilityChange() {
      if (!mounted) return;
      if (document.visibilityState === "visible") {
        setReloadToken((v) => v + 1);
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("sedes:updated", onUpdated);
      window.addEventListener("focus", onUpdated);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("sedes:updated", onUpdated);
        window.removeEventListener("focus", onUpdated);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [includeInactive, reloadToken]);

  return { sedes, loadingSedes, reloadSedes };
}
