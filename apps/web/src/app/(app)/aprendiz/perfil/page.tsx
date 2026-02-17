"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

type Perfil = {
  id: number;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  documento: string | null;
  rol: string;
  estado: string;
  sede_principal: string | null;
  jornada: string | null;
  programa_formacion: string | null;
  telefono: string | null;
  must_change_password: boolean;
  force_password_reset: boolean;
  pending_email_change?: string | null;
};

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

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">{value || "-"}</p>
    </div>
  );
}

export default function AprendizPerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTipo, setMsgTipo] = useState<"ok" | "err" | null>(null);

  const [telefono, setTelefono] = useState("");

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const passwordRules = buildPasswordRules(newPw, newPw2);
  const passwordRulesValid = passwordRules.every((rule) => rule.valid);
  const passkeySupported = typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;

  const nombreBonito = useMemo(() => {
    if (!perfil) return "-";
    const n = `${perfil.first_name ?? ""} ${perfil.last_name ?? ""}`.trim();
    return n || perfil.username;
  }, [perfil]);

  async function cargarPerfil() {
    setLoading(true);
    try {
      const r = await api.get("/api/aprendiz/perfil/");
      setPerfil(r.data?.perfil ?? null);
      setTelefono(r.data?.perfil?.telefono ?? "");
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo cargar el perfil."));
      setMsgTipo("err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarPerfil();
  }, []);

  async function guardarTelefono() {
    setMsg(null);
    setMsgTipo(null);
    setSaving(true);
    try {
      const r = await api.patch("/api/aprendiz/perfil/", { telefono });
      setPerfil(r.data?.perfil ?? perfil);
      setTelefono(r.data?.perfil?.telefono ?? telefono);
      setMsg(r.data?.mensaje || "Perfil actualizado.");
      setMsgTipo("ok");
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo actualizar el perfil."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function solicitarCambioEmail() {
    setMsg(null);
    setMsgTipo(null);
    setSaving(true);
    try {
      const r = await api.post("/api/aprendiz/perfil/email-change/request/", { new_email: newEmail.trim().toLowerCase() });
      setMsg(r.data?.mensaje || "OTP enviado al nuevo correo.");
      setMsgTipo("ok");
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo solicitar el cambio de correo."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function confirmarCambioEmail() {
    setMsg(null);
    setMsgTipo(null);
    setSaving(true);
    try {
      const r = await api.post("/api/aprendiz/perfil/email-change/confirm/", {
        new_email: newEmail.trim().toLowerCase(),
        otp: emailOtp.trim(),
      });
      setPerfil(r.data?.perfil ?? perfil);
      setNewEmail("");
      setEmailOtp("");
      setEmailOpen(false);
      setMsg(r.data?.mensaje || "Correo actualizado.");
      setMsgTipo("ok");
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo confirmar el cambio de correo."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarContrasena() {
    setMsg(null);
    setMsgTipo(null);
    if (!passwordRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
      setMsgTipo("err");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/auth/change-initial-password/", {
        current_password: currentPw,
        new_password: newPw,
      });
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
      setPwOpen(false);
      setMsg("Contrasena actualizada.");
      setMsgTipo("ok");
      await cargarPerfil();
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo cambiar la contrasena."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  async function registrarPasskey() {
    if (!passkeySupported) {
      setMsg("Tu navegador no soporta Passkeys/WebAuthn.");
      setMsgTipo("err");
      return;
    }
    setMsg(null);
    setMsgTipo(null);
    setPasskeyLoading(true);
    try {
      const options = await api.post("/api/auth/passkeys/register/options/", { nickname: "Passkey web" });
      const challenge = new TextEncoder().encode(options.data.challenge);
      const userId = new TextEncoder().encode(String(perfil?.id || ""));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: options.data.rp,
          user: {
            id: userId,
            name: perfil?.username || "user",
            displayName: `${perfil?.first_name || ""} ${perfil?.last_name || ""}`.trim() || perfil?.username || "user",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: options.data.timeout || 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("No se pudo crear la passkey.");

      const bytes = new Uint8Array(credential.rawId);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
      const credentialId = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

      await api.post("/api/auth/passkeys/register/verify/", {
        request_id: options.data.request_id,
        challenge: options.data.challenge,
        credential_id: credentialId,
      });
      setMsg("Passkey registrada correctamente.");
      setMsgTipo("ok");
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo registrar la passkey."));
      setMsgTipo("err");
    } finally {
      setPasskeyLoading(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-zinc-600">Cargando perfil...</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_12px_34px_rgba(2,6,23,0.07)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Perfil del aprendiz</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">Mi perfil</h2>
            <p className="mt-1 text-sm text-zinc-600">Solo puedes editar telefono y solicitar cambio de correo con OTP.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => setEmailOpen(true)}
              className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Cambiar correo
            </button>
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)] transition hover:brightness-105"
            >
              Cambiar contrasena
            </button>
            <button
              onClick={registrarPasskey}
              disabled={passkeyLoading}
              className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60"
            >
              {passkeyLoading ? "Registrando passkey..." : "Registrar passkey"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Aprendiz</div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">{nombreBonito}</div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Cuenta {perfil?.estado ?? "-"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DataCard label="Documento" value={perfil?.documento ?? "-"} />
            <DataCard label="Correo" value={perfil?.email ?? "-"} />
            <DataCard label="Centro de formacion" value={perfil?.sede_principal ?? "-"} />
            <DataCard label="Programa" value={perfil?.programa_formacion ?? "-"} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/80 bg-white/80 p-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Telefono</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                value={telefono}
                maxLength={20}
                onChange={(e) => setTelefono(e.target.value.replace(/[^\d]/g, "").slice(0, 20))}
                placeholder="3001234567"
              />
              <button
                onClick={guardarTelefono}
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {perfil?.pending_email_change ? (
              <p className="mt-2 text-xs text-amber-700">Correo pendiente por confirmar: {perfil.pending_email_change}</p>
            ) : null}
          </div>

          {msg ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm ${
                msgTipo === "ok" ? "border-emerald-200 bg-emerald-50/90 text-emerald-800" : "border-red-200 bg-red-50/90 text-red-700"
              }`}
            >
              {msg}
            </div>
          ) : null}
        </section>
      </div>

      {emailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-zinc-900">Cambiar correo con OTP</h3>
            <p className="mt-1 text-sm text-zinc-600">Primero solicita OTP y luego confirma el codigo.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700">Nuevo correo</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nuevo@correo.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700">Codigo OTP</label>
                <input
                  className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm tracking-[0.2em]"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="12345"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={solicitarCambioEmail}
                disabled={saving || !newEmail.trim()}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Enviar OTP
              </button>
              <button
                onClick={confirmarCambioEmail}
                disabled={saving || !newEmail.trim() || emailOtp.trim().length !== 5}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                Confirmar correo
              </button>
              <button
                onClick={() => setEmailOpen(false)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pwOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-zinc-900">Cambiar contrasena</h3>
            <p className="mt-1 text-sm text-zinc-600">Requiere la contrasena actual.</p>

            <div className="mt-4 space-y-3">
              <input
                type="password"
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value.slice(0, 20))}
                placeholder="Contrasena actual"
              />
              <input
                type="password"
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value.slice(0, 20))}
                placeholder="Nueva contrasena"
              />
              <input
                type="password"
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value.slice(0, 20))}
                placeholder="Confirmar contrasena"
              />
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
                disabled={saving || !passwordRulesValid || !currentPw}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Actualizar contrasena"}
              </button>
              <button
                onClick={() => setPwOpen(false)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
