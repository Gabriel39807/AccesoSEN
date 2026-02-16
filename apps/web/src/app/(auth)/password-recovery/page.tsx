"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Step = "email" | "otp" | "newpass" | "done";
type Channel = "email" | "whatsapp";
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

export default function PasswordRecoveryWebPage() {
  const [step, setStep] = useState<Step>("email");
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rules = buildPasswordRules(newPass, newPass2);
  const allRulesValid = rules.every((rule) => rule.valid);
  const identifier =
    channel === "whatsapp"
      ? { telefono: telefono.trim() }
      : { email: email.trim().toLowerCase() };

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (channel === "email" && !email.trim()) {
      setMsg("Ingresa un correo para enviar el OTP.");
      return;
    }
    if (channel === "whatsapp" && !telefono.trim()) {
      setMsg("Ingresa un numero de celular para enviar el OTP.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await api.post("/api/auth/password-reset/request/", { ...identifier, channel });
      setStep("otp");
      setMsg(`Si el usuario existe, enviamos un codigo OTP por ${channel === "whatsapp" ? "WhatsApp" : "correo"}.`);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || err?.response?.data?.motivo || "No se pudo enviar el codigo.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/api/auth/password-reset/verify/", { ...identifier, otp: otp.trim(), channel });
      if (!r?.data?.permitido) throw new Error(r?.data?.motivo || "OTP invalido.");
      setStep("newpass");
    } catch (err: any) {
      setMsg(err?.message || err?.response?.data?.message || err?.response?.data?.motivo || "OTP invalido.");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!allRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/api/auth/password-reset/confirm/", {
        ...identifier,
        otp: otp.trim(),
        new_password: newPass,
        channel,
      });
      if (!r?.data?.permitido) throw new Error(r?.data?.motivo || "No se pudo cambiar la contrasena.");
      setStep("done");
    } catch (err: any) {
      setMsg(err?.message || err?.response?.data?.message || err?.response?.data?.motivo || "No se pudo cambiar la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl border bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-zinc-900">Recuperar contrasena</h1>

        {step === "email" && (
          <form onSubmit={onEmail} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`rounded-lg border p-2 text-sm font-semibold ${channel === "email" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-700"}`}
              >
                Correo
              </button>
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`rounded-lg border p-2 text-sm font-semibold ${channel === "whatsapp" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-700"}`}
              >
                WhatsApp
              </button>
            </div>
            {channel === "email" ? (
              <input
                className="w-full rounded-lg border p-2"
                placeholder="correo@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            ) : (
              <input
                className="w-full rounded-lg border p-2"
                placeholder="+573001112233"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            )}
            <p className="text-sm text-zinc-600">
              {channel === "whatsapp"
                ? "El OTP se enviara por WhatsApp al numero de celular registrado en la cuenta."
                : "El OTP se enviara al correo registrado en esta cuenta."}
            </p>
            <button disabled={loading} className="w-full rounded-lg bg-emerald-600 p-2 font-semibold text-white disabled:opacity-50">
              {loading ? "Enviando..." : "Enviar codigo"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={onVerify} className="mt-4 space-y-3">
            <p className="text-sm text-zinc-600">
              Ingresa el codigo enviado por {channel === "whatsapp" ? "WhatsApp" : "correo"}.
            </p>
            <input
              className="w-full rounded-lg border p-2 text-center tracking-[0.4em]"
              placeholder="12345"
              maxLength={5}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button disabled={loading} className="w-full rounded-lg bg-zinc-900 p-2 font-semibold text-white disabled:opacity-50">
              {loading ? "Verificando..." : "Verificar OTP"}
            </button>
          </form>
        )}

        {step === "newpass" && (
          <form onSubmit={onConfirm} className="mt-4 space-y-3">
            <input
              type="password"
              className="w-full rounded-lg border p-2"
              placeholder="Nueva contrasena"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-lg border p-2"
              placeholder="Confirmar contrasena"
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
            />
            <div className="rounded-lg border bg-zinc-50 p-3 text-sm">
              <div className="mb-1 font-semibold text-zinc-900">Checklist de seguridad</div>
              <ul className="space-y-1 text-zinc-600">
                {rules.map((rule) => (
                  <li key={rule.id} className={rule.valid ? "text-emerald-700" : "text-zinc-600"}>
                    {rule.valid ? "[OK]" : "[ ]"} {rule.label}
                  </li>
                ))}
              </ul>
            </div>
            <button
              disabled={loading || !allRulesValid}
              className="w-full rounded-lg bg-emerald-600 p-2 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Cambiar contrasena"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Contrasena actualizada correctamente.
            </div>
            <Link href="/login" className="block w-full rounded-lg bg-emerald-600 p-2 text-center text-sm font-semibold text-white">
              Volver a iniciar sesion
            </Link>
          </div>
        )}

        {msg && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>}

        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-zinc-600 hover:underline">
          Volver
        </Link>
      </div>
    </div>
  );
}
