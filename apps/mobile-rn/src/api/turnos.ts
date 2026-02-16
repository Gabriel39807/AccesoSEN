import { api } from "./client";

export type Sede = "CEGAFE" | "SANTA_CLARA" | "ITEDRIS" | "GASTRONOMIA";
export type Jornada = "MANANA" | "TARDE" | "NOCHE";

export type Turno = {
  id: number;
  guarda: number;
  sede: Sede;
  jornada: Jornada;
  inicio: string;
  fin: string | null;
  activo: boolean;
};

export async function iniciarTurno(sede: Sede, jornada: Jornada) {
  const r = await api.post("/api/turnos/iniciar/", { sede, jornada });
  return r.data as { permitido: boolean; motivo: string | null; turno: Turno };
}

export async function finalizarTurno() {
  const r = await api.post("/api/turnos/finalizar/");
  return r.data as { permitido: boolean; motivo: string | null; turno: Turno | null };
}

export async function turnoActual() {
  const r = await api.get("/api/turnos/actual/");
  return r.data as { permitido: boolean; motivo: string | null; activo?: false; turno?: Turno };
}

export async function reanudarTurno() {
  const r = await api.post("/api/turnos/reanudar/");
  return r.data as { permitido: boolean; motivo: string | null; turno: Turno };
}

export async function estadoActualGuardia() {
  const r = await api.get("/api/guardia/estado-actual/");
  return r.data as { permitido: boolean; motivo: string | null; turno_activo: boolean; turno: Turno | null };
}

export async function resumenTurno(id: number) {
  const r = await api.get(`/api/turnos/${id}/resumen/`);
  return r.data as {
    permitido: boolean;
    motivo: string | null;
    turno: Turno;
    resumen: { ingresos: number; salidas: number; total: number };
  };
}
