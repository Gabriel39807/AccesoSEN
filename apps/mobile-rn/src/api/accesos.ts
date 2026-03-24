import { api } from "./client";

export type EquipoAprobado = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
};

export type ValidarDocumentoOK = {
  permitido: true;
  estado: "dentro" | "fuera";
  aprendiz: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    documento: string;
  };
  equipos_aprobados: EquipoAprobado[];
  turno: { id: number; sede: string; jornada: string };
};

let registroSequence = 0;

export function createRegistroIdempotencyKey(documento: string, tipo: "ingreso" | "salida") {
  registroSequence += 1;
  const normalized = String(documento || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-24)
    .toLowerCase();
  return `scan-${tipo}-${normalized || "manual"}-${Date.now().toString(36)}-${registroSequence.toString(36)}`;
}

export async function validarDocumento(documento: string) {
  const r = await api.post("/api/accesos/validar_documento/", { documento });
  const d = r.data as any;
  const equipos = d?.equipos_aprobados ?? d?.equipos ?? [];
  return {
    permitido: true,
    estado: d?.estado === "dentro" ? "dentro" : "fuera",
    aprendiz: d?.aprendiz,
    equipos_aprobados: equipos,
    turno: d?.turno,
  } as ValidarDocumentoOK;
}

export async function registrarPorDocumento(params: {
  documento: string;
  tipo: "ingreso" | "salida";
  equipos?: number[];
}, options?: { idempotencyKey?: string }) {
  const headers = options?.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : undefined;
  const r = await api.post("/api/accesos/registrar_por_documento/", params, headers ? { headers } : undefined);
  return r.data as any;
}

// cache simple para pasar data entre pantallas sin state global
export const __cache = new Map<string, any>();
export const __registroCache = new Map<string, any>();


export async function stats() {
  const r = await api.get("/api/accesos/stats/");
  return r.data as {
    permitido: boolean;
    motivo: string | null;
    turno?: { id: number; sede: string; jornada: string };
    stats?: { ingresos: number; salidas: number; total: number };
  };
}
