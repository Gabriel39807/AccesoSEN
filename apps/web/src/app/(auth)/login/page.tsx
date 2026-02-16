"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens, saveTokens } from "@/lib/auth";
import { toErrorMessage } from "@/lib/errors";

type MeResponse = {
  permitido: boolean;
  motivo: string | null;
  usuario: {
    id: number;
    username: string;
    rol: "admin" | "aprendiz" | "guarda";
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "student">("admin");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokenRes = await api.post("/api/token/", { username, password });
      saveTokens({ access: tokenRes.data.access, refresh: tokenRes.data.refresh });

      const meRes = await api.get<MeResponse>("/api/me/");
      const rol = meRes.data.usuario.rol;
      if (rol === "admin") router.replace("/admin/usuarios");
      else if (rol === "aprendiz") router.replace("/aprendiz/inicio");
      else {
        await clearTokens();
        setError("El rol guarda no esta habilitado en la web. Usa la app movil para control de acceso.");
      }
    } catch (err: any) {
      setError(toErrorMessage(err, "Credenciales invalidas."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
              SENA
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Sistema de Control de Acceso</h1>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-2">
            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setError(null);
              }}
              className={[
                "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
                role === "admin" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-800",
              ].join(" ")}
            >
              Administrador
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("student");
                setError(null);
              }}
              className={[
                "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
                role === "student" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-800",
              ].join(" ")}
            >
              Estudiante
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-600">
            {role === "admin"
              ? "Administrador: ingresa con tu correo institucional."
              : "Estudiante: ingresa con tu documento."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800">
                {role === "admin" ? "Correo institucional" : "Documento de identidad"}
              </label>
              <input
                className="h-12 w-full rounded-2xl border bg-slate-50 px-4 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
                placeholder={role === "admin" ? "admin@sena.edu.co" : "Ingresa tu documento"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                inputMode={role === "student" ? "numeric" : "email"}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-800">Contrasena</label>
              <input
                type="password"
                className="h-12 w-full rounded-2xl border bg-slate-50 px-4 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-emerald-600 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Iniciar sesion"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/password-recovery")}
              className="w-full rounded-xl border p-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Olvide mi contrasena
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
