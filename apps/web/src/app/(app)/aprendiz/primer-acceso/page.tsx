"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

type Step = 1 | 2 | 3;

type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

type ToastState = {
  type: "ok" | "error";
  text: string;
} | null;

function buildPasswordRules(password: string, confirmPassword: string): PasswordRule[] {
  return [
    { id: "len", label: "Minimo 8 caracteres", valid: password.length >= 8 },
    { id: "upper", label: "Al menos 1 mayuscula", valid: /[A-Z]/.test(password) },
    { id: "lower", label: "Al menos 1 minuscula", valid: /[a-z]/.test(password) },
    { id: "num", label: "Al menos 1 numero", valid: /[0-9]/.test(password) },
    { id: "special", label: "Al menos 1 caracter especial", valid: /[^A-Za-z0-9]/.test(password) },
    {
      id: "match",
      label: "Coincide con la confirmacion",
      valid: confirmPassword.length > 0 && password === confirmPassword,
    },
  ];
}

function getPasswordStrength(password: string): {
  tone: "weak" | "medium" | "strong";
  label: string;
  score: number;
} {
  if (!password) return { tone: "weak", label: "Sin definir", score: 0 };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { tone: "weak", label: "Debil", score };
  if (score <= 4) return { tone: "medium", label: "Media", score };
  return { tone: "strong", label: "Fuerte", score };
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function FieldError({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{text}</p>;
}

function WizardIndicator({ step }: { step: Step }) {
  const items = [
    { id: 1, title: "Identidad", subtitle: "Verifica tu documento" },
    { id: 2, title: "Datos", subtitle: "Confirma tu perfil" },
    { id: 3, title: "Seguridad", subtitle: "Define credenciales" },
  ] as const;

  const progress = (step / items.length) * 100;

  return (
    <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-[0_8px_24px_rgba(2,6,23,0.06)]">
      <div className="mb-3 h-2 w-full rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const active = step === item.id;
          const done = step > item.id;
          return (
            <div key={item.id} className="rounded-2xl border border-zinc-100 bg-white/70 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-emerald-100 text-emerald-700"
                      : active
                        ? "bg-sky-100 text-sky-700"
                        : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {done ? "OK" : item.id}
                </span>
                <p className={`text-sm font-semibold ${active ? "text-zinc-900" : "text-zinc-600"}`}>{item.title}</p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PrimerAccesoPage() {
  const router = useRouter();
  const { me, loadingMe } = useMe();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedStep, setSubmittedStep] = useState<Step | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  const [documento, setDocumento] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sede, setSede] = useState("");
  const [programa, setPrograma] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [verifyEmailModalOpen, setVerifyEmailModalOpen] = useState(false);
  const [verifyEmailInput, setVerifyEmailInput] = useState("");
  const [verifyEmailError, setVerifyEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    if (!me) return;
    setDocumento(me.documento ?? "");
    setFirstName(me.first_name ?? "");
    setLastName(me.last_name ?? "");
    setEmail(me.email ?? "");
    setOriginalEmail(me.email ?? "");
    setSede(me.sede_principal ?? "");
    setPrograma(me.programa_formacion ?? "");
  }, [me]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const passwordRules = useMemo(() => buildPasswordRules(newPassword, confirmPassword), [newPassword, confirmPassword]);
  const allPasswordRulesValid = passwordRules.every((rule) => rule.valid);
  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const showErrors = submittedStep === step;

  const identityError = showErrors && !identityConfirmed ? "Debes confirmar la verificacion de identidad." : null;

  const emailError = showErrors && !isValidEmail(email) ? "Ingresa un correo valido." : null;

  const currentPasswordError = showErrors && !currentPassword ? "Ingresa la contrasena inicial actual." : null;
  const newPasswordError = showErrors && !allPasswordRulesValid ? "La nueva contrasena no cumple los requisitos." : null;
  const termsError = showErrors && !acceptTerms ? "Debes aceptar los terminos de uso." : null;

  function validateStep(targetStep: Step): string | null {
    if (targetStep === 1) {
      if (!identityConfirmed) return "Debes confirmar la verificacion de identidad.";
      return null;
    }
    if (targetStep === 2) {
      if (!isValidEmail(email)) return "Ingresa un correo valido.";
      return null;
    }
    if (!currentPassword) return "Ingresa la contrasena inicial actual.";
    if (!allPasswordRulesValid) return "La nueva contrasena no cumple todos los requisitos.";
    if (!acceptTerms) return "Debes aceptar los terminos de uso.";
    return null;
  }

  function goNext() {
    setSubmittedStep(step);
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      setToast({ type: "error", text: err });
      return;
    }

    if (step === 2) {
      const changedEmail = email.trim() !== (originalEmail || "").trim();
      if (changedEmail) {
        setVerifyEmailInput("");
        setVerifyEmailError(null);
        setVerifyEmailModalOpen(true);
        return;
      }
    }

    setStepError(null);
    setSubmittedStep(null);
    setStep((prev) => (prev === 3 ? 3 : ((prev + 1) as Step)));
  }

  function goBack() {
    setStepError(null);
    setSubmittedStep(null);
    setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)));
  }

  function confirmNewEmail() {
    if (verifyEmailInput.trim() !== email.trim()) {
      setVerifyEmailError("La verificacion no coincide con el nuevo correo.");
      return;
    }
    setVerifyEmailError(null);
    setVerifyEmailModalOpen(false);
    setStepError(null);
    setSubmittedStep(null);
    setStep(3);
    setToast({ type: "ok", text: "Correo verificado correctamente." });
  }

  async function handleFinish() {
    setSubmittedStep(3);
    const err = validateStep(3);
    if (err) {
      setStepError(err);
      setToast({ type: "error", text: err });
      return;
    }

    if (!me) {
      const msg = "No se encontro informacion del aprendiz. Recarga e intenta de nuevo.";
      setStepError(msg);
      setToast({ type: "error", text: msg });
      return;
    }

    setStepError(null);
    setSubmitting(true);
    try {
      const changedEmail = email.trim() !== (originalEmail || "").trim();
      if (changedEmail) {
        try {
          await api.patch(`/api/usuarios/${me.id}/`, {
            email: email.trim(),
          });
        } catch {
          setToast({
            type: "error",
            text: "No fue posible actualizar el correo en este paso. Se continuara con la activacion.",
          });
        }
      }

      await api.post("/api/auth/change-initial-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      router.replace("/aprendiz/inicio");
    } catch (error: unknown) {
      const msg = toErrorMessage(error, "No se pudo activar la cuenta.");
      setStepError(msg);
      setToast({ type: "error", text: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMe) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_10px_28px_rgba(2,6,23,0.06)]">
          <div className="h-7 w-64 animate-pulse rounded-xl bg-zinc-100" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-lg bg-zinc-100" />
          <div className="mt-7 h-28 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-72 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-red-200 bg-red-50/90 p-6 text-red-800 shadow-sm">
        <h1 className="text-lg font-extrabold">No se pudieron cargar tus datos</h1>
        <p className="mt-2 text-sm">Recarga la pagina para continuar con el primer inicio de sesion.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {toast ? (
        <div
          className={`fixed right-5 top-5 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_10px_32px_rgba(2,6,23,0.08)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Onboarding SADI</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">Primer inicio de sesion</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Completa estos datos para activar tu cuenta y acceder al sistema.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            Cuenta estudiante
          </span>
        </div>
      </section>

      <WizardIndicator step={step} />

      <section className="grid gap-4 lg:grid-cols-12">
        <aside className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Seguridad y acceso</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-zinc-900">Tu cuenta en proceso de activacion</h2>
          <p className="mt-2 text-sm text-zinc-600">Este proceso es obligatorio y solo toma unos minutos.</p>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Documento</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{documento || "Sin registrar"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Usuario</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{me.username}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-sky-50/65 p-4 text-xs text-zinc-600">
              Protege tu cuenta. No compartas tu contrasena y valida tus datos antes de finalizar.
            </div>
          </div>
        </aside>

        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] lg:col-span-8">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Paso 1. Verificacion de identidad</h3>
                <p className="mt-1 text-sm text-zinc-600">Revisa tu documento y confirma que corresponde a tu cuenta.</p>
              </div>

              <div>
                <label htmlFor="doc" className="text-sm font-semibold text-zinc-800">
                  Documento
                </label>
                <input
                  id="doc"
                  value={documento}
                  onChange={(e) => setDocumento(normalizeDigits(e.target.value).slice(0, 10))}
                  inputMode="numeric"
                  disabled
                  placeholder="Documento"
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                />
                <p className="mt-1 text-xs text-zinc-500">El documento solo puede ser actualizado por un administrador.</p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={identityConfirmed}
                  onChange={(e) => setIdentityConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-zinc-700">Confirmo que mi identidad corresponde a esta cuenta.</span>
              </label>
              <FieldError text={identityError} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Paso 2. Datos del aprendiz</h3>
                <p className="mt-1 text-sm text-zinc-600">Confirma o ajusta tus datos personales para activar la cuenta.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="text-sm font-semibold text-zinc-800">
                    Nombres
                  </label>
                  <input
                    id="first_name"
                    value={firstName}
                    disabled
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700 outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Solo administracion puede modificar este dato.</p>
                </div>

                <div>
                  <label htmlFor="last_name" className="text-sm font-semibold text-zinc-800">
                    Apellidos
                  </label>
                  <input
                    id="last_name"
                    value={lastName}
                    disabled
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700 outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Solo administracion puede modificar este dato.</p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="email" className="text-sm font-semibold text-zinc-800">
                    Correo institucional o alternativo
                  </label>
                  <input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@dominio.com"
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                  <FieldError text={emailError} />
                </div>

                <div>
                  <label htmlFor="sede" className="text-sm font-semibold text-zinc-800">
                    Sede
                  </label>
                  <input
                    id="sede"
                    value={sede}
                    disabled
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700 outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Solo administracion puede modificar este dato.</p>
                </div>

                <div>
                  <label htmlFor="programa" className="text-sm font-semibold text-zinc-800">
                    Programa
                  </label>
                  <input
                    id="programa"
                    value={programa}
                    disabled
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700 outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Solo administracion puede modificar este dato.</p>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Paso 3. Seguridad de la cuenta</h3>
                <p className="mt-1 text-sm text-zinc-600">Crea una contrasena segura y acepta terminos para finalizar.</p>
              </div>

              <div>
                <label htmlFor="current_password" className="text-sm font-semibold text-zinc-800">
                  Contrasena inicial actual
                </label>
                <input
                  id="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
                <FieldError text={currentPasswordError} />
              </div>

              <div>
                <label htmlFor="new_password" className="text-sm font-semibold text-zinc-800">
                  Nueva contrasena
                </label>
                <input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />

                <div className="mt-2 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Fuerza de contrasena</p>
                    <p
                      className={`text-xs font-semibold ${
                        passwordStrength.tone === "strong"
                          ? "text-emerald-700"
                          : passwordStrength.tone === "medium"
                            ? "text-amber-700"
                            : "text-red-700"
                      }`}
                    >
                      {passwordStrength.label}
                    </p>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        passwordStrength.tone === "strong"
                          ? "bg-emerald-500"
                          : passwordStrength.tone === "medium"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>

                  <ul className="mt-3 space-y-1 text-xs">
                    {passwordRules.map((rule) => (
                      <li key={rule.id} className={rule.valid ? "text-emerald-700" : "text-zinc-600"}>
                        {rule.valid ? "OK" : "[ ]"} {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <FieldError text={newPasswordError} />
              </div>

              <div>
                <label htmlFor="confirm_password" className="text-sm font-semibold text-zinc-800">
                  Confirmar nueva contrasena
                </label>
                <input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
                {confirmPassword ? (
                  <p className={`mt-1 text-xs font-medium ${newPassword === confirmPassword ? "text-emerald-700" : "text-red-600"}`}>
                    {newPassword === confirmPassword ? "Las contrasenas coinciden." : "La confirmacion no coincide."}
                  </p>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-zinc-700">Acepto los terminos de uso y las politicas de seguridad de SADI.</span>
              </label>
              <FieldError text={termsError} />
            </div>
          ) : null}

          {stepError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {stepError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || submitting}
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atras
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(2,132,199,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(5,150,105,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Finalizando..." : "Finalizar"}
              </button>
            )}
          </div>
        </div>
      </section>

      {verifyEmailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-extrabold tracking-tight text-zinc-900">Verificar nuevo correo</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Para continuar, confirma el nuevo correo ingresado.
            </p>

            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-800">
              Nuevo correo: <span className="font-semibold">{email || "-"}</span>
            </div>

            <div className="mt-4">
              <label htmlFor="verify_email_modal" className="text-sm font-semibold text-zinc-800">
                Escribe de nuevo el correo
              </label>
              <input
                id="verify_email_modal"
                value={verifyEmailInput}
                onChange={(e) => setVerifyEmailInput(e.target.value)}
                placeholder="correo@dominio.com"
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
              <FieldError text={verifyEmailError} />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setVerifyEmailModalOpen(false);
                  setVerifyEmailError(null);
                }}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmNewEmail}
                className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Verificar y continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
