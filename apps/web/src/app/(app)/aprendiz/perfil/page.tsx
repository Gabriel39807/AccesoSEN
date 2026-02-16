"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { useMe } from "@/hooks/useMe";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

function buildPasswordRules(password: string, confirmPassword: string): PasswordRule[] {
  return [
    { id: "len", label: "Minimo 8 caracteres", valid: password.length >= 8 },
    { id: "upper", label: "Al menos 1 mayuscula", valid: /[A-Z]/.test(password) },
    { id: "lower", label: "Al menos 1 minuscula", valid: /[a-z]/.test(password) },
    { id: "num", label: "Al menos 1 numero", valid: /[0-9]/.test(password) },
    { id: "special", label: "Al menos 1 caracter especial", valid: /[^A-Za-z0-9]/.test(password) },
    { id: "match", label: "Coincide con la confirmacion", valid: confirmPassword.length > 0 && password === confirmPassword },
  ];
}

function safeErrorMessage(e: any) {
  return (
    e?.response?.data?.detail ??
    e?.response?.data?.motivo ??
    (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : null) ??
    "No se pudo completar la acción."
  );
}

export default function AprendizPerfilPage() {
  const { me, loadingMe } = useMe();

  // modal editar
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTipo, setMsgTipo] = useState<"ok" | "err" | null>(null);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [sede, setSede] = useState("");
  const [programa, setPrograma] = useState("");

  // cambiar contraseña
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const passwordRules = buildPasswordRules(pw, pw2);
  const passwordRulesValid = passwordRules.every((rule) => rule.valid);

  useEffect(() => {
    if (!me) return;
    setFirst(me.first_name ?? "");
    setLast(me.last_name ?? "");
    setEmail(me.email ?? "");
    setSede(me.sede_principal ?? "");
    setPrograma(me.programa_formacion ?? "");
  }, [me]);

  const nombreBonito = useMemo(() => {
    if (!me) return "—";
    const n = `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim();
    return n || me.username;
  }, [me]);

  async function guardarPerfil() {
    if (!me) return;
    setMsg(null);
    setMsgTipo(null);
    setSaving(true);
    try {
      // NOTA: En el backend actual, este endpoint suele ser solo Admin.
      // Se deja implementado para cuando se habilite auto-actualización.
      await api.patch(`/api/usuarios/${me.id}/`, {
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim(),
        sede_principal: sede ? sede : null,
        programa_formacion: programa ? programa : null,
      });
      setMsg("✅ Perfil actualizado.");
      setMsgTipo("ok");
      setEditing(false);
    } catch (e: any) {
      setMsg(safeErrorMessage(e));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarContrasena() {
    if (!me) return;
    setMsg(null);
    setMsgTipo(null);

    if (!passwordRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
      setMsgTipo("err");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/usuarios/${me.id}/`, {
        password: pw,
      });
      setMsg("✅ Contraseña actualizada.");
      setMsgTipo("ok");
      setPwOpen(false);
      setPw("");
      setPw2("");
    } catch (e: any) {
      setMsg(safeErrorMessage(e));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900">Mi perfil</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Consulta tus datos y gestiona tu cuenta.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Editar perfil
            </button>
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Cambiar contraseña
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5 shadow-sm lg:col-span-2">
          <div className="text-xs font-semibold tracking-wide text-emerald-700">Aprendiz</div>
          <div className="mt-1 text-2xl font-extrabold text-zinc-900">
            {loadingMe ? "Cargando..." : nombreBonito}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Documento</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {me?.documento ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Correo</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {me?.email ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Centro de formación</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {me?.sede_principal ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Programa</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {me?.programa_formacion ?? "—"}
              </div>
            </div>
          </div>

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

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-zinc-900">Seguridad</h3>
          <div className="mt-4 space-y-3 text-sm text-zinc-700">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Estado de la cuenta</div>
              <div className="mt-1 font-semibold text-zinc-900">
                {me?.estado ?? "—"}
              </div>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Recomendación</div>
              <div className="mt-1">
                Usa una contraseña fuerte (mínimo 8 caracteres) y no la compartas.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900">Editar perfil</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Actualiza tus datos personales.
                </p>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nombre</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Apellido</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-700">Correo</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700">Centro</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                  placeholder="Ej: CEGAFE"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Programa</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={programa}
                  onChange={(e) => setPrograma(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={guardarPerfil}
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
        </div>
      )}

      {/* MODAL CONTRASEÑA */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-lg rounded-3xl border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900">Cambiar contraseña</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Usa una clave fuerte y única.
                </p>
              </div>
              <button
                onClick={() => setPwOpen(false)}
                className="rounded-full border px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nueva contraseña</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
              </div>
              <div className="rounded-2xl border bg-zinc-50 p-4 text-xs text-zinc-600">
                <div className="mb-2 font-semibold text-zinc-900">Checklist de seguridad</div>
                <ul className="space-y-1">
                  {passwordRules.map((rule) => (
                    <li key={rule.id} className={rule.valid ? "text-emerald-700" : "text-zinc-600"}>
                      {rule.valid ? "[OK]" : "[ ]"} {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={cambiarContrasena}
                disabled={saving || !passwordRulesValid}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Actualizar contraseña"}
              </button>
              <button
                onClick={() => setPwOpen(false)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
