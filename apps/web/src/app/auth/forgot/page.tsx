"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../lib/api";

export default function ForgotPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/password-reset/request/", { email });
      router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      console.log("FORGOT ERROR:", err?.response?.data);

      setError(
        err?.response?.data?.detail ??
          JSON.stringify(err?.response?.data ?? {}) ??
          "No se pudo enviar el código."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
            SENA
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Recuperar contraseña</h1>
            <p className="text-sm text-slate-600">Te enviaremos un código de verificación.</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">Correo institucional</label>
            <input
              className="w-full h-12 rounded-2xl border px-4 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
              placeholder="ejemplo@sena.edu.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar código"}
          </button>

          <div className="text-sm text-slate-600">
            ¿Recordaste tu contraseña?{" "}
            <Link href="/login" className="text-emerald-700 hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
