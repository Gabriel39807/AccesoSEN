"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Usuario = {
  id: number;
  username: string;
  rol: "superadmin" | "admin_sede" | "guarda" | "aprendiz" | string;
  first_name?: string;
  last_name?: string;
};

type Turno = {
  id: number;
  guarda: number; // en tu serializer viene como id del guarda
  sede: "CEGAFE" | "SANTA_CLARA" | "ITEDRIS" | "GASTRONOMIA";
  jornada: "MAÑANA" | "TARDE" | "NOCHE";
  inicio: string;
  fin: string | null;
  activo: boolean;
};

const SEDES: Turno["sede"][] = ["CEGAFE", "SANTA_CLARA", "ITEDRIS", "GASTRONOMIA"];
const JORNADAS: Turno["jornada"][] = ["MAÑANA", "TARDE", "NOCHE"];

function badgeBase() {
  return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border";
}
function badgeEstado(turno: Turno) {
  const isActivo = turno.activo && !turno.fin;
  return isActivo
    ? `${badgeBase()} bg-emerald-100 text-emerald-800 border-emerald-200`
    : `${badgeBase()} bg-gray-100 text-gray-800 border-gray-200`;
}
function badgeJornada(j: Turno["jornada"]) {
  if (j === "MAÑANA") return `${badgeBase()} bg-sky-100 text-sky-800 border-sky-200`;
  if (j === "TARDE") return `${badgeBase()} bg-amber-100 text-amber-800 border-amber-200`;
  return `${badgeBase()} bg-indigo-100 text-indigo-800 border-indigo-200`;
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "—";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function formatFecha(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function safeErrorMessage(e: any) {
  return (
    (typeof e?.response?.data?.message === "string" ? e.response.data.message : null) ??
    (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : null) ??
    (typeof e?.response?.data?.motivo === "string" ? e.response.data.motivo : null) ??
    e?.response?.data?.detail ??
    e?.response?.data?.motivo ??
    (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ??
    e?.message ??
    "Ocurrio un error."
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="px-3 py-1 rounded-lg border hover:bg-gray-50">
            ✖
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminTurnosPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filtros (API soporta sede/jornada/activo)
  const [sede, setSede] = useState<"" | Turno["sede"]>("");
  const [jornada, setJornada] = useState<"" | Turno["jornada"]>("");
  const [activo, setActivo] = useState<"" | "true" | "false">("");

  // filtro extra (cliente)
  const [guardaId, setGuardaId] = useState<number | "">("");

  // modal finalizar
  const [openFinalizar, setOpenFinalizar] = useState(false);
  const [turnoFinalizar, setTurnoFinalizar] = useState<Turno | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const usuariosMap = useMemo(() => {
    const m = new Map<number, Usuario>();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const guardas = useMemo(() => usuarios.filter((u) => u.rol === "guarda"), [usuarios]);

  const rows = useMemo(() => {
    let r = [...turnos];
    if (guardaId !== "") r = r.filter((t) => t.guarda === guardaId);
    return r;
  }, [turnos, guardaId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activosCount = rows.filter((t) => t.activo && !t.fin).length;
    const finalizados = rows.filter((t) => !t.activo || !!t.fin).length;
    return { total, activos: activosCount, finalizados };
  }, [rows]);

  async function cargarUsuarios() {
    const res = await api.get("/api/usuarios/");
    const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    setUsuarios(data);
  }

  async function cargarTurnos() {
    const params: any = {};
    if (sede) params.sede = sede;
    if (jornada) params.jornada = jornada;
    if (activo) params.activo = activo;

    const res = await api.get("/api/turnos/", { params });
    const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
    setTurnos(data);
  }

  async function cargarBase() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([cargarUsuarios(), cargarTurnos()]);
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function refrescar() {
    setReloading(true);
    setError(null);
    try {
      await cargarTurnos();
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setReloading(false);
    }
  }

  function resetFiltros() {
    setSede("");
    setJornada("");
    setActivo("");
    setGuardaId("");
  }

  function abrirFinalizar(t: Turno) {
    setTurnoFinalizar(t);
    setOpenFinalizar(true);
  }

  async function confirmarFinalizar() {
    if (!turnoFinalizar) return;
    setFinalizando(true);
    setError(null);

    try {
      const res = await api.post(`/api/turnos/${turnoFinalizar.id}/finalizar_admin/`);
      // respuesta UI-friendly: { permitido, motivo, turno }
      if (res?.data?.permitido === false) {
        alert(res?.data?.motivo ?? "No se pudo finalizar el turno.");
      }
      setOpenFinalizar(false);
      setTurnoFinalizar(null);
      await cargarTurnos();
    } catch (e: any) {
      const msg = safeErrorMessage(e) || "No se pudo finalizar el turno.";
      alert(msg);
      await cargarTurnos();
    } finally {
      setFinalizando(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Admin / Turnos</h1>
            <p className="text-sm text-gray-500">
              Lista de turnos por sede/jornada, con finalización manual por admin.
            </p>
          </div>

          <button
            onClick={refrescar}
            disabled={reloading}
            className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 shadow-sm transition"
          >
            {reloading ? "Recargando..." : "Recargar"}
          </button>
        </div>

        {/* STATS */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="text-left bg-white rounded-2xl shadow-sm border p-4">
            <div className="text-2xl">📋</div>
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-emerald-900">{stats.total}</div>
          </div>

          <div className="text-left bg-white rounded-2xl shadow-sm border p-4">
            <div className="text-2xl">🟢</div>
            <div className="text-sm text-gray-500">Activos</div>
            <div className="text-2xl font-bold text-emerald-700">{stats.activos}</div>
            <div className="text-xs text-gray-500 mt-1">activo=true y sin fin</div>
          </div>

          <div className="text-left bg-white rounded-2xl shadow-sm border p-4">
            <div className="text-2xl">✅</div>
            <div className="text-sm text-gray-500">Finalizados</div>
            <div className="text-2xl font-bold text-gray-900">{stats.finalizados}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={sede}
              onChange={(e) => setSede(e.target.value as any)}
            >
              <option value="">Sede</option>
              {SEDES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={jornada}
              onChange={(e) => setJornada(e.target.value as any)}
            >
              <option value="">Jornada</option>
              {JORNADAS.map((j) => (
                <option key={j} value={j}>
                  {j === "MAÑANA" ? "Mañana" : j === "TARDE" ? "Tarde" : "Noche"}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={activo}
              onChange={(e) => setActivo(e.target.value as any)}
            >
              <option value="">Activo (API)</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>

            <select
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={guardaId}
              onChange={(e) => setGuardaId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Guarda (cliente)</option>
              {guardas.map((g) => (
                <option key={g.id} value={g.id}>
                  {nombreUsuario(g)}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => cargarTurnos().catch(() => setError("No se pudieron cargar los turnos."))}
                className="w-full md:w-auto rounded-xl px-4 py-2 bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition"
              >
                Aplicar
              </button>
              <button
                onClick={() => {
                  resetFiltros();
                  setTimeout(() => cargarTurnos().catch(() => {}), 0);
                }}
                className="w-full md:w-auto rounded-xl px-4 py-2 border bg-white hover:bg-gray-50 transition"
              >
                Limpiar
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm text-gray-600">{loading ? "Cargando..." : `${rows.length} turnos`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">ID</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Guarda</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Sede</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Jornada</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Inicio</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Fin</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No hay turnos con los filtros actuales.
                    </td>
                  </tr>
                ) : null}

                {rows.map((t) => {
                  const u = usuariosMap.get(t.guarda) ?? null;
                  const isActivo = t.activo && !t.fin;

                  return (
                    <tr key={t.id} className="border-b hover:bg-emerald-50/30 transition">
                      <td className="px-4 py-3 font-semibold text-gray-900">#{t.id}</td>
                      <td className="px-4 py-3 text-gray-800">{nombreUsuario(u)}</td>
                      <td className="px-4 py-3 text-gray-800">{t.sede.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={badgeJornada(t.jornada)}>
                          {t.jornada === "MAÑANA" ? "Mañana" : t.jornada === "TARDE" ? "Tarde" : "Noche"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{formatFecha(t.inicio)}</td>
                      <td className="px-4 py-3 text-gray-800">{formatFecha(t.fin)}</td>
                      <td className="px-4 py-3">
                        <span className={badgeEstado(t)}>{isActivo ? "Activo" : "Finalizado"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => abrirFinalizar(t)}
                          disabled={!isActivo}
                          className="rounded-xl px-3 py-2 text-xs font-semibold border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          title={isActivo ? "Finalizar turno (admin)" : "El turno ya está finalizado"}
                        >
                          ⛔ Finalizar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal finalizar */}
        <Modal
          open={openFinalizar}
          title="Finalizar turno (Admin)"
          onClose={() => {
            if (finalizando) return;
            setOpenFinalizar(false);
            setTurnoFinalizar(null);
          }}
        >
          {turnoFinalizar ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-gray-50 p-4 text-sm">
                <div>
                  <span className="text-gray-500">Turno:</span>{" "}
                  <span className="font-semibold">#{turnoFinalizar.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Guarda:</span>{" "}
                  <span className="font-semibold">{nombreUsuario(usuariosMap.get(turnoFinalizar.guarda) ?? null)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sede:</span>{" "}
                  <span className="font-semibold">{turnoFinalizar.sede.replace("_", " ")}</span>
                </div>
                <div>
                  <span className="text-gray-500">Jornada:</span>{" "}
                  <span className="font-semibold">
                    {turnoFinalizar.jornada === "MAÑANA"
                      ? "Mañana"
                      : turnoFinalizar.jornada === "TARDE"
                      ? "Tarde"
                      : "Noche"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Inicio:</span>{" "}
                  <span className="font-semibold">{formatFecha(turnoFinalizar.inicio)}</span>
                </div>
              </div>

              <div className="text-sm text-gray-700">
                Esto finalizará el turno inmediatamente. Úsalo solo si el guarda olvidó cerrar el turno.
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    if (finalizando) return;
                    setOpenFinalizar(false);
                    setTurnoFinalizar(null);
                  }}
                  className="rounded-xl px-4 py-2 border bg-white hover:bg-gray-50 transition"
                  disabled={finalizando}
                >
                  Cancelar
                </button>

                <button
                  onClick={confirmarFinalizar}
                  className="rounded-xl px-4 py-2 bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition disabled:opacity-60"
                  disabled={finalizando}
                >
                  {finalizando ? "Finalizando..." : "Sí, finalizar"}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}
