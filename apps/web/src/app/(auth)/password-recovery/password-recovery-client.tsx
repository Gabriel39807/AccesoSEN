"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";
import { AuthButton, AuthCard, AuthInput, AuthLayout } from "@/components/auth";
import styles from "@/components/auth/auth.module.css";

type Step = "request" | "sent" | "reset" | "done";
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

export default function PasswordRecoveryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStep = searchParams.get("step");
  const initialStep: Step =
    queryStep === "sent" || queryStep === "reset" || queryStep === "done" ? queryStep : "request";

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState(searchParams.get("otp") ?? "");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rules = buildPasswordRules(newPass, newPass2);
  const allRulesValid = rules.every((rule) => rule.valid);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedEmail) {
      setError("Ingresa un correo para enviar el codigo.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("El correo no tiene un formato valido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/password-reset/request/", { email: normalizedEmail });
      setStep("sent");
      setNotice("Si la cuenta existe, enviamos un codigo de verificacion a tu correo.");
    } catch (err: unknown) {
      setError(toErrorMessage(err, "No se pudo enviar el codigo."));
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(otp.trim())) {
      setError("El codigo OTP debe tener 5 digitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.post("/api/auth/password-reset/verify/", {
        email: normalizedEmail,
        otp: otp.trim(),
      });
      if (!r?.data?.permitido) throw new Error(r?.data?.motivo || "OTP invalido.");
      setStep("reset");
      setNotice("Codigo verificado. Ahora define tu nueva contrasena.");
    } catch (err: unknown) {
      setError(toErrorMessage(err, "Codigo invalido o expirado."));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (!normalizedEmail) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/password-reset/request/", { email: normalizedEmail });
      setNotice("Reenviamos un nuevo codigo al correo registrado.");
    } catch (err: unknown) {
      setError(toErrorMessage(err, "No se pudo reenviar el codigo."));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!allRulesValid) {
      setError("La nueva contrasena no cumple todos los requisitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.post("/api/auth/password-reset/confirm/", {
        email: normalizedEmail,
        otp: otp.trim(),
        new_password: newPass,
      });
      if (!r?.data?.permitido) throw new Error(r?.data?.motivo || "No se pudo cambiar la contrasena.");
      setStep("done");
      setNotice("Contrasena actualizada correctamente.");
    } catch (err: unknown) {
      setError(toErrorMessage(err, "No se pudo cambiar la contrasena."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      role="aprendiz"
      title="Recuperacion de contrasena"
      subtitle="Protege tu cuenta con un flujo seguro de verificacion y cambio de clave."
      badge="Soporte de acceso"
    >
      <AuthCard className="p-5 md:p-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Restablecer acceso</h2>
          <p className="text-xs text-slate-500">Seguiremos un proceso corto para validar tu identidad.</p>
        </div>

        {step === "request" ? (
          <form onSubmit={onRequest} className="mt-5 space-y-4">
            <AuthInput
              id="recovery-email"
              label="Correo"
              type="email"
              placeholder="usuario@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              error={null}
              hint="Enviaremos un OTP al correo asociado a tu cuenta."
            />
            <AuthButton type="submit" loading={loading} loadingLabel="Enviando..." className="w-full">
              Enviar codigo
            </AuthButton>
          </form>
        ) : null}

        {step === "sent" ? (
          <form onSubmit={onVerify} className="mt-5 space-y-4">
            <p className={`${styles.status} ${styles.statusInfo}`}>Revisa tu correo y escribe el codigo OTP de 5 digitos.</p>
            <AuthInput
              id="recovery-otp"
              label="Codigo OTP"
              placeholder="12345"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
              className="text-center tracking-[0.36em]"
              error={null}
              hint={`Codigo enviado a ${normalizedEmail || "tu correo"}.`}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AuthButton type="submit" loading={loading} loadingLabel="Verificando..." className="w-full">
                Verificar codigo
              </AuthButton>
              <AuthButton type="button" variant="secondary" onClick={resendCode} loading={loading} className="w-full">
                Reenviar
              </AuthButton>
            </div>
          </form>
        ) : null}

        {step === "reset" ? (
          <form onSubmit={onConfirm} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-pass" className="block text-sm font-semibold text-slate-800">
                Nueva contrasena
              </label>
              <div className="relative">
                <input
                  id="new-pass"
                  type={showPass1 ? "text" : "password"}
                  className={styles.input}
                  placeholder="Nueva contrasena"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoComplete="new-password"
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={() => setShowPass1((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                >
                  {showPass1 ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-pass" className="block text-sm font-semibold text-slate-800">
                Confirmar contrasena
              </label>
              <div className="relative">
                <input
                  id="confirm-pass"
                  type={showPass2 ? "text" : "password"}
                  className={styles.input}
                  placeholder="Confirmar contrasena"
                  value={newPass2}
                  onChange={(e) => setNewPass2(e.target.value)}
                  autoComplete="new-password"
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={() => setShowPass2((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                >
                  {showPass2 ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rules.map((rule) => (
                <p key={rule.id} className={`${styles.checkItem} ${rule.valid ? styles.checkItemOk : ""}`}>
                  {rule.valid ? "OK" : "..."} {rule.label}
                </p>
              ))}
            </div>

            <AuthButton type="submit" loading={loading} loadingLabel="Actualizando..." disabled={!allRulesValid} className="w-full">
              Cambiar contrasena
            </AuthButton>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="mt-5 space-y-4">
            <p className={`${styles.status} ${styles.statusSuccess}`}>Tu contrasena fue actualizada exitosamente.</p>
            <AuthButton type="button" className="w-full" onClick={() => router.push("/login")}>
              Ir a iniciar sesion
            </AuthButton>
          </div>
        ) : null}

        {notice ? <p className={`mt-4 ${styles.status} ${styles.statusSuccess}`}>{notice}</p> : null}
        {error ? <p className={`mt-4 ${styles.status} ${styles.statusError}`}>{error}</p> : null}

        {step !== "done" ? (
          <AuthButton type="button" variant="secondary" className="mt-4 w-full" onClick={() => router.push("/login")}>
            Volver al login
          </AuthButton>
        ) : null}
      </AuthCard>
    </AuthLayout>
  );
}
