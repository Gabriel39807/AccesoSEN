import { api } from "./client";

export type SedeItem = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export async function listSedes() {
  const r = await api.get("/api/public/sedes/");
  return (r.data?.results || r.data || []) as SedeItem[];
}
