"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "../../../lib/api";

export default function ResetPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  const otp = sp.get("otp") ?? "";

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(() => {
    const min8 = p1.length >= 8;
    const upper = /[A-Z]/.test(p1);
    const num = /\d/.test(p1);
    const match = p1.length > 0 && p1 === p2;
    return { min8, upper, num, match, ok: min8 && upper && num && match && !!email && !!otp };
  }, [p1, p2, email, otp]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/auth/password-reset/confirm/", { email, otp, new_password: p1 });

      router.push("/auth/success");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "No se pudo actualizar la contraseña. Verifica el código e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-6 md:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Nueva contraseña</h1>
        <p className="text-sm text-slate-600 mt-1">
          Crea una contraseña segura para tu cuenta.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">Contraseña</label>
            <input
              type="password"
              className="w-full h-12 rounded-2xl border px-4 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="Mín. 8 caracteres"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">Confirmar contraseña</label>
            <input
              type="password"
              className="w-full h-12 rounded-2xl border px-4 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold mb-2">Requisitos:</p>
            <ul className="space-y-1">
              <li className={rules.min8 ? "text-emerald-700" : ""}>• Mínimo 8 caracteres</li>
              <li className={rules.upper ? "text-emerald-700" : ""}>• Una letra mayúscula</li>
              <li className={rules.num ? "text-emerald-700" : ""}>• Un número</li>
              <li className={rules.match ? "text-emerald-700" : ""}>• Coincidencia de contraseñas</li>
            </ul>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !rules.ok}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
