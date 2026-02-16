"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type Equipo = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado" | string;
  motivo_rechazo?: string | null;
  revisado_en?: string | null;
  creado_en?: string | null;
};

type Acceso = {
  id: number;
  tipo: "ingreso" | "salida" | string;
  fecha: string;
  equipos?: number[];
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function badgeEstado(estado: string) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (estado === "aprobado") return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
  if (estado === "rechazado") return `${base} bg-red-50 text-red-800 border-red-200`;
  return `${base} bg-amber-50 text-amber-900 border-amber-200`;
}

function badgeUbicacion(ubi: "DENTRO" | "FUERA" | "SIN_REGISTROS") {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (ubi === "DENTRO") return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
  if (ubi === "FUERA") return `${base} bg-sky-50 text-sky-800 border-sky-200`;
  return `${base} bg-zinc-100 text-zinc-700 border-zinc-200`;
}

function ubicacionPorAccesos(equipoId: number, accesos: Acceso[]): "DENTRO" | "FUERA" | "SIN_REGISTROS" {
  for (const a of accesos) {
    if (!Array.isArray(a.equipos)) continue;
    if (!a.equipos.includes(equipoId)) continue;
    if (a.tipo === "ingreso") return "DENTRO";
    if (a.tipo === "salida") return "FUERA";
  }
  return "SIN_REGISTROS";
}

export default function AprendizEquipoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const idNum = Number(params?.id);

  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [accesos, setAccesos] = useState<Acceso[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edición (se intenta, aunque el backend actual puede restringirlo)
  const [editing, setEditing] = useState(false);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [serial, setSerial] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTipo, setMsgTipo] = useState<"ok" | "err" | null>(null);

  const ubicacion = useMemo(() => {
    if (!equipo) return "SIN_REGISTROS" as const;
    return ubicacionPorAccesos(equipo.id, accesos);
  }, [equipo, accesos]);

  async function cargar() {
    if (!idNum || Number.isNaN(idNum)) {
      setError("ID de equipo inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMsg(null);
    setMsgTipo(null);

    try {
      const [equipoRes, accesosRes] = await Promise.all([
        api.get<Equipo>(`/api/equipos/${idNum}/`),
        api.get("/api/accesos/mis_accesos/"),
      ]);

      setEquipo(equipoRes.data);
      setMarca(equipoRes.data.marca ?? "");
      setModelo(equipoRes.data.modelo ?? "");
      setSerial(equipoRes.data.serial ?? "");

      const accesosData = Array.isArray(accesosRes.data)
        ? accesosRes.data
        : accesosRes.data?.results ?? [];
      setAccesos(accesosData);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        "No se pudo cargar el equipo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNum]);

  async function guardarCambios() {
    setMsg(null);
    setMsgTipo(null);

    if (!equipo) return;
    if (!serial.trim() || !marca.trim() || !modelo.trim()) {
      setMsg("Completa serial, marca y modelo.");
      setMsgTipo("err");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/equipos/${equipo.id}/`, {
        serial: serial.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
      });
      setMsg("✅ Cambios guardados.");
      setMsgTipo("ok");
      setEditing(false);
      await cargar();
    } catch (e: any) {
      const err =
        e?.response?.data?.detail ??
        (typeof e?.response?.data === "object"
          ? JSON.stringify(e.response.data)
          : null) ??
        "No se pudieron guardar los cambios.";
      setMsg(err);
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarEquipo() {
    setMsg(null);
    setMsgTipo(null);

    if (!equipo) return;
    const ok = window.confirm(
      "¿Seguro que deseas eliminar este equipo? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    setSaving(true);
    try {
      await api.delete(`/api/equipos/${equipo.id}/`);
      setMsg("✅ Equipo eliminado.");
      setMsgTipo("ok");
      setTimeout(() => router.push("/aprendiz/equipos"), 500);
    } catch (e: any) {
      const err =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        "No se pudo eliminar el equipo.";
      setMsg(err);
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900">Detalles del equipo</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Consulta la información del equipo y su estado.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => router.back()}
              className="rounded-full border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Volver
            </button>
            <button
              onClick={cargar}
              className="rounded-full border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Recargar
            </button>
          </div>
        </div>

        {loading && <div className="mt-4 text-sm text-zinc-500">Cargando...</div>}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && equipo && (
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {/* BLOQUE PRINCIPAL */}
            <div className="rounded-3xl border bg-white p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-wide text-emerald-700">
                    {ubicacion === "SIN_REGISTROS" ? "Sin movimientos" : ubicacion}
                  </div>
                  <div className="mt-1 truncate text-xl font-extrabold text-zinc-900">
                    {equipo.marca} {equipo.modelo}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">Serial: {equipo.serial}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={badgeEstado(equipo.estado)}>{equipo.estado}</span>
                  <span className={badgeUbicacion(ubicacion)}>
                    {ubicacion === "SIN_REGISTROS" ? "Sin registros" : ubicacion}
                  </span>
                </div>
              </div>

              {equipo.estado === "rechazado" && equipo.motivo_rechazo && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span className="font-semibold">Motivo del rechazo:</span> {equipo.motivo_rechazo}
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Creado</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {fmt(equipo.creado_en)}
                  </div>
                </div>
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Última revisión</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {fmt(equipo.revisado_en)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  {editing ? "Cancelar edición" : "Editar información"}
                </button>
                <button
                  onClick={eliminarEquipo}
                  disabled={saving}
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Eliminar equipo
                </button>
              </div>

              {editing && (
                <div className="mt-5 rounded-3xl border bg-white p-5">
                  <h3 className="text-sm font-extrabold text-zinc-900">Editar información</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-zinc-700">Serial</label>
                      <input
                        className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                        value={serial}
                        onChange={(e) => setSerial(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-700">Marca</label>
                      <input
                        className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                        value={marca}
                        onChange={(e) => setMarca(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-zinc-700">Modelo</label>
                      <input
                        className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                        value={modelo}
                        onChange={(e) => setModelo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={guardarCambios}
                      disabled={saving}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {msg && (
                <div
                  className={cx(
                    "mt-5 rounded-2xl border p-4 text-sm",
                    msgTipo === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    msgTipo === "err" && "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {msg}
                </div>
              )}
            </div>

            {/* LATERAL */}
            <div className="rounded-3xl border bg-white p-5">
              <h3 className="text-sm font-extrabold text-zinc-900">Información</h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Estado de revisión</div>
                  <div className="mt-1 font-semibold text-zinc-900">{equipo.estado}</div>
                </div>
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Ubicación estimada</div>
                  <div className="mt-1 font-semibold text-zinc-900">
                    {ubicacion === "SIN_REGISTROS" ? "Sin registros" : ubicacion}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Se calcula usando el último acceso que incluya este equipo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
