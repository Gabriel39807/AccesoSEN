"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";
import { useMe } from "@/hooks/useMe";
import { useSedes } from "@/hooks/useSedes";

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
  sede: string;
  sede_name?: string;
  jornada: "MAÃƒâ€˜ANA" | "TARDE" | "NOCHE";
  inicio: string;
  fin: string | null;
  activo: boolean;
};

const JORNADAS: Turno["jornada"][] = ["MAÃƒâ€˜ANA", "TARDE", "NOCHE"];

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
  if (j === "MAÃƒâ€˜ANA") return `${badgeBase()} bg-sky-100 text-sky-800 border-sky-200`;
  if (j === "TARDE") return `${badgeBase()} bg-amber-100 text-amber-800 border-amber-200`;
  return `${badgeBase()} bg-indigo-100 text-indigo-800 border-indigo-200`;
}

function nombreUsuario(u?: Usuario | null) {
  if (!u) return "Ã¢â‚¬â€";
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return full || u.username;
}

function formatFecha(iso?: string | null) {
  if (!iso) return "Ã¢â‚¬â€";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Ã¢â‚¬â€";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
            Ã¢Å“â€“
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminTurnosPage() {
  const { me } = useMe();
  const { sedes } = useSedes();
  const actorRol = me?.rol ?? null;
  const actorSede = me?.sede_principal ?? null;
  const isScopedAdmin = actorRol === "admin_sede";
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filtros (API soporta sede/jornada/activo)
  const [sede, setSede] = useState("");
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
    if (isScopedAdmin) {
      if (actorSede) params.sede_id = actorSede;
    } else if (sede) {
      params.sede_id = sede;
    }
    if (jornada) params.jornada = jornada;
    if (activo) params.activo = activo;
    if (guardaId !== "") params.guardia_id = guardaId;

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
      setError(toErrorMessage(e, "No se pudieron cargar los turnos."));
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
      setError(toErrorMessage(e, "No se pudieron cargar los turnos."));
    } finally {
      setReloading(false);
    }
  }

  function resetFiltros() {
    if (isScopedAdmin && actorSede) setSede(actorSede);
    else setSede("");
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
        setError(toErrorMessage({ response: { data: res?.data } }, "No se pudo finalizar el turno."));
      }
      setOpenFinalizar(false);
      setTurnoFinalizar(null);
      await cargarTurnos();
    } catch (e: any) {
      const msg = toErrorMessage(e, "No se pudo finalizar el turno.");
      setError(msg);
      await cargarTurnos();
    } finally {
      setFinalizando(false);
    }
  }

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isScopedAdmin) return;
    if (!actorSede) return;
    setSede(actorSede);
  }, [isScopedAdmin, actorSede]);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">Admin / Turnos</h1>
            <p className="text-sm text-gray-500">
              Lista de turnos por sede/jornada, con finalizaciÃƒÂ³n manual por admin.
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
            <div className="text-2xl">Ã°Å¸â€œâ€¹</div>
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-emerald-900">{stats.total}</div>
          </div>

          <div className="text-left bg-white rounded-2xl shadow-sm border p-4">
            <div className="text-2xl">Ã°Å¸Å¸Â¢</div>
            <div className="text-sm text-gray-500">Activos</div>
            <div className="text-2xl font-bold text-emerald-700">{stats.activos}</div>
            <div className="text-xs text-gray-500 mt-1">activo=true y sin fin</div>
          </div>

          <div className="text-left bg-white rounded-2xl shadow-sm border p-4">
            <div className="text-2xl">Ã¢Å“â€¦</div>
            <div className="text-sm text-gray-500">Finalizados</div>
            <div className="text-2xl font-bold text-gray-900">{stats.finalizados}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {isScopedAdmin ? (
              <div className="w-full rounded-xl border px-3 py-2 text-sm bg-slate-50 text-slate-700">
                Sede fija: {String(actorSede || sede || "Sin sede")}
              </div>
            ) : (
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={sede}
                onChange={(e) => setSede(e.target.value)}
              >
                <option value="">Sede: Todas</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
              value={jornada}
              onChange={(e) => setJornada(e.target.value as any)}
            >
              <option value="">Jornada</option>
              {JORNADAS.map((j) => (
                <option key={j} value={j}>
                  {j === "MAÃƒâ€˜ANA" ? "MaÃƒÂ±ana" : j === "TARDE" ? "Tarde" : "Noche"}
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
                      <td className="px-4 py-3 text-gray-800">{t.sede_name || t.sede}</td>
                      <td className="px-4 py-3">
                        <span className={badgeJornada(t.jornada)}>
                          {t.jornada === "MAÃƒâ€˜ANA" ? "MaÃƒÂ±ana" : t.jornada === "TARDE" ? "Tarde" : "Noche"}
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
                          title={isActivo ? "Finalizar turno (admin)" : "El turno ya estÃƒÂ¡ finalizado"}
                        >
                          Ã¢â€ºâ€ Finalizar
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
                  <span className="font-semibold">{turnoFinalizar.sede_name || turnoFinalizar.sede}</span>
                </div>
                <div>
                  <span className="text-gray-500">Jornada:</span>{" "}
                  <span className="font-semibold">
                    {turnoFinalizar.jornada === "MAÃƒâ€˜ANA"
                      ? "MaÃƒÂ±ana"
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
                Esto finalizarÃƒÂ¡ el turno inmediatamente. ÃƒÅ¡salo solo si el guarda olvidÃƒÂ³ cerrar el turno.
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
                  {finalizando ? "Finalizando..." : "SÃƒÂ­, finalizar"}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}
