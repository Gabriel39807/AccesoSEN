"use client";

import { useEffect, useMemo, useState } from "react";

import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

type ApiErrorShape = {
  response?: {
    data?: {
      detail?: string;
      motivo?: string;
      message?: string;
    };
  };
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

function safeErrorMessage(e: unknown) {
  const err = e as ApiErrorShape;
  return (
    err.response?.data?.detail ??
    err.response?.data?.motivo ??
    err.response?.data?.message ??
    "No se pudo completar la accion."
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">{value || "-"}</p>
    </div>
  );
}

export default function AprendizPerfilPage() {
  const { me, loadingMe } = useMe();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTipo, setMsgTipo] = useState<"ok" | "err" | null>(null);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [sede, setSede] = useState("");
  const [programa, setPrograma] = useState("");

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
    if (!me) return "-";
    const n = `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim();
    return n || me.username;
  }, [me]);

  async function guardarPerfil() {
    if (!me) return;
    setMsg(null);
    setMsgTipo(null);
    setSaving(true);
    try {
      await api.patch(`/api/usuarios/${me.id}/`, {
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim(),
        sede_principal: sede ? sede : null,
        programa_formacion: programa ? programa : null,
      });
      setMsg("Perfil actualizado.");
      setMsgTipo("ok");
      setEditing(false);
    } catch (e: unknown) {
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
      setMsg("La nueva contraseÃ±a no cumple todos los requisitos.");
      setMsgTipo("err");
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/usuarios/${me.id}/`, {
        password: pw,
      });
      setMsg("ContraseÃ±a actualizada.");
      setMsgTipo("ok");
      setPwOpen(false);
      setPw("");
      setPw2("");
    } catch (e: unknown) {
      setMsg(safeErrorMessage(e));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_12px_34px_rgba(2,6,23,0.07)] backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-16 -top-14 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Perfil del aprendiz</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">Mi perfil</h2>
            <p className="mt-1 text-sm text-zinc-600">Consulta tus datos personales y administra tu cuenta.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              Editar perfil
            </button>
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              Cambiar contraseÃ±a
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Aprendiz</div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">
                {loadingMe ? "Cargando..." : nombreBonito}
              </div>
            </div>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Cuenta {me?.estado ?? "-"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DataCard label="Documento" value={me?.documento ?? "-"} />
            <DataCard label="Correo" value={me?.email ?? "-"} />
            <DataCard label="Centro de formacion" value={me?.sede_principal ?? "-"} />
            <DataCard label="Programa" value={me?.programa_formacion ?? "-"} />
          </div>

          {msg ? (
            <div
              className={cx(
                "mt-5 rounded-2xl border p-4 text-sm",
                msgTipo === "ok" && "border-sky-200 bg-sky-50/90 text-sky-800",
                msgTipo === "err" && "border-red-200 bg-red-50/90 text-red-700"
              )}
            >
              {msg}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-4">
          <h3 className="text-base font-extrabold tracking-tight text-zinc-900">Seguridad</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estado de la cuenta</p>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-zinc-900">{me?.estado ?? "-"}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-zinc-700">
              Usa una contraseÃ±a fuerte (minimo 8 caracteres), unica y evita compartirla.
            </div>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-3xl border border-white/80 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900">Editar perfil</h3>
                <p className="mt-1 text-sm text-zinc-600">Actualiza tus datos personales.</p>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nombre</label>
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={first} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Apellido</label>
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-700">Correo</label>
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                <input className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={programa} onChange={(e) => setPrograma(e.target.value)} />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={guardarPerfil}
                disabled={saving}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pwOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900">Cambiar contraseÃ±a</h3>
                <p className="mt-1 text-sm text-zinc-600">Usa una clave fuerte y unica.</p>
              </div>
              <button
                onClick={() => setPwOpen(false)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nueva contraseÃ±a</label>
                <input type="password" className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Confirmar nueva contraseÃ±a</label>
                <input type="password" className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <div className="rounded-2xl border bg-zinc-50 p-4 text-xs text-zinc-600">
                <div className="mb-2 font-semibold text-zinc-900">Checklist de seguridad</div>
                <ul className="space-y-1">
                  {passwordRules.map((rule) => (
                    <li key={rule.id} className={rule.valid ? "text-sky-700" : "text-zinc-600"}>
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
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Actualizar contraseÃ±a"}
              </button>
              <button
                onClick={() => setPwOpen(false)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

