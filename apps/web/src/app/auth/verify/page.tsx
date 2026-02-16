"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "../../../lib/api";

export default function VerifyPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => otp.length === 5 && !!email, [otp, email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

try {
  await api.post("/auth/password-reset/verify/", { email, otp });

  router.push(
    `/auth/reset?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
  );


    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Código inválido o expirado. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/password-reset/request/", { email });
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "No se pudo reenviar el código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-6 md:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Verificación</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ingresa el código enviado a <span className="font-medium">{email || "tu correo"}</span>.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">Código (OTP)</label>
            <input
              className="w-full h-12 rounded-2xl border px-4 text-lg tracking-[0.35em] text-center outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
              placeholder="_____"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Verificar"}
          </button>

          <button
            type="button"
            onClick={resend}
            disabled={loading || !email}
            className="w-full h-12 rounded-2xl border font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
          >
            Reenviar código
          </button>
        </form>
      </section>
    </main>
  );
}
