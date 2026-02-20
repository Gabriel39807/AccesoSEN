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

export function useSedes() {
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [loadingSedes, setLoadingSedes] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const res = await api.get<SedeItem[] | Paginated<SedeItem>>("/api/sedes/");
        const rows = Array.isArray(res.data) ? res.data : (res.data as Paginated<SedeItem>).results ?? [];
        if (mounted) setSedes(rows);
      } catch {
        if (mounted) setSedes([]);
      } finally {
        if (mounted) setLoadingSedes(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return { sedes, loadingSedes };
}
