"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

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
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function estadoLabel(estado: string) {
  if (estado === "aprobado") return "Aprobado";
  if (estado === "rechazado") return "Rechazado";
  return "Pendiente";
}

function badgeEstado(estado: string) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
  if (estado === "aprobado") return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
  if (estado === "rechazado") return `${base} bg-red-50 text-red-800 border-red-200`;
  return `${base} bg-amber-50 text-amber-900 border-amber-200`;
}

function ubicacionLabel(ubi: "DENTRO" | "FUERA" | "SIN_REGISTROS") {
  if (ubi === "DENTRO") return "Dentro del centro";
  if (ubi === "FUERA") return "Fuera del centro";
  return "Sin registros";
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

  const [editing, setEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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

  const canMutate = equipo?.estado === "pendiente";

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
    } catch (e: unknown) {
      setError(toErrorMessage(e, "No se pudo cargar el equipo."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [idNum]);

  async function guardarCambios() {
    setMsg(null);
    setMsgTipo(null);

    if (!equipo) return;
    if (!canMutate) {
      setMsg("Solo puedes editar equipos en estado pendiente.");
      setMsgTipo("err");
      return;
    }
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
      setMsg("Cambios guardados.");
      setMsgTipo("ok");
      setEditing(false);
      await cargar();
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudieron guardar los cambios."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  function solicitarEliminar() {
    setMsg(null);
    setMsgTipo(null);
    if (!equipo) return;
    if (!canMutate) {
      setMsg("Solo puedes eliminar equipos en estado pendiente.");
      setMsgTipo("err");
      return;
    }
    setConfirmDeleteOpen(true);
  }

  async function eliminarEquipo() {
    if (!equipo) return;
    setSaving(true);
    try {
      await api.delete(`/api/equipos/${equipo.id}/`);
      setMsg("Equipo eliminado.");
      setMsgTipo("ok");
      setConfirmDeleteOpen(false);
      setTimeout(() => router.push("/aprendiz/equipos"), 500);
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo eliminar el equipo."));
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
            <h2 className="text-lg font-extrabold text-zinc-900">Detalle del equipo</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Consulta la información del equipo y su estado actual.
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
              onClick={() => void cargar()}
              className="rounded-full border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Recargar
            </button>
          </div>
        </div>

        {loading ? <div className="mt-4 text-sm text-zinc-500">Cargando...</div> : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && equipo ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border bg-white p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-wide text-emerald-700">
                    {ubicacionLabel(ubicacion)}
                  </div>
                  <div className="mt-1 truncate text-xl font-extrabold text-zinc-900">
                    {equipo.marca} {equipo.modelo}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">Serial: {equipo.serial}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={badgeEstado(equipo.estado)}>{estadoLabel(equipo.estado)}</span>
                  <span className={badgeUbicacion(ubicacion)}>{ubicacionLabel(ubicacion)}</span>
                </div>
              </div>

              {equipo.estado === "rechazado" && equipo.motivo_rechazo ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span className="font-semibold">Motivo del rechazo:</span> {equipo.motivo_rechazo}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Creado</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmt(equipo.creado_en)}</div>
                </div>
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Última revisión</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">{fmt(equipo.revisado_en)}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  onClick={() => {
                    if (editing) {
                      setEditing(false);
                      return;
                    }
                    if (!canMutate) {
                      setMsg("Solo puedes editar equipos en estado pendiente.");
                      setMsgTipo("err");
                      return;
                    }
                    setEditing(true);
                  }}
                  className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  {editing ? "Cancelar edición" : "Editar información"}
                </button>
                <button
                  onClick={solicitarEliminar}
                  disabled={saving || !canMutate}
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Eliminar equipo
                </button>
              </div>

              {!canMutate ? (
                <div className="mt-2 text-xs text-zinc-500">
                  Solo puedes editar o eliminar equipos en estado pendiente.
                </div>
              ) : null}

              {editing ? (
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
              ) : null}

              {msg ? (
                <div
                  className={cx(
                    "mt-5 rounded-2xl border p-4 text-sm",
                    msgTipo === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    msgTipo === "err" && "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {msg}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border bg-white p-5">
              <h3 className="text-sm font-extrabold text-zinc-900">Información</h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Estado de revisión</div>
                  <div className="mt-1 font-semibold text-zinc-900">{estadoLabel(equipo.estado)}</div>
                </div>
                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-xs text-zinc-500">Ubicación estimada</div>
                  <div className="mt-1 font-semibold text-zinc-900">{ubicacionLabel(ubicacion)}</div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Se calcula usando el último acceso que incluya este equipo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={confirmDeleteOpen}
        title="Confirmar eliminación de equipo"
        onClose={() => {
          if (saving) return;
          setConfirmDeleteOpen(false);
        }}
        closeDisabled={saving}
        maxWidthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            Vas a eliminar este equipo de forma permanente. Esta acción no se puede deshacer.
          </p>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <div>
              <span className="font-semibold">Serial:</span> {equipo?.serial}
            </div>
            <div>
              <span className="font-semibold">Equipo:</span> {equipo?.marca} {equipo?.modelo}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={saving}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminarEquipo}
              disabled={saving}
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {saving ? "Eliminando..." : "Eliminar equipo"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
