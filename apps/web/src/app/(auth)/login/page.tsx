"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

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
   console.log("LOGIN PAGE LOADED ✅");
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
      // 1) Login -> tokens
      const tokenRes = await api.post("/api/token/", { username, password });
      saveTokens({
        access: tokenRes.data.access,
        refresh: tokenRes.data.refresh,
      });

      // 2) /api/me -> rol
      const meRes = await api.get<MeResponse>("/api/me/");
      const rol = meRes.data.usuario.rol;

      // 3) Redirección por rol
      if (rol === "admin") router.replace("/admin/usuarios");
      else if (rol === "aprendiz") router.replace("/aprendiz/inicio");
      else router.replace("/login");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

return (
  <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-emerald-50 px-4 py-10">
    <div className="w-full max-w-md rounded-3xl border bg-white shadow-sm p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
          SENA
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sistema de Control de Acceso</h1>
        </div>
      </div>

      {/* Tabs Admin / Estudiante */}
      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-2">
        <button
          type="button"
          onClick={() => {
            setRole("admin");
            setError(null);
            // opcional: limpiar campos al cambiar
            // setUsername("");
            // setPassword("");
          }}
          className={[
            "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
            role === "admin"
              ? "bg-white shadow-sm text-emerald-700"
              : "text-slate-600 hover:text-slate-800",
          ].join(" ")}
        >
          Administrador
        </button>

        <button
          type="button"
          onClick={() => {
            setRole("student");
            setError(null);
            // opcional: limpiar campos al cambiar
            // setUsername("");
            // setPassword("");
          }}
          className={[
            "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
            role === "student"
              ? "bg-white shadow-sm text-emerald-700"
              : "text-slate-600 hover:text-slate-800",
          ].join(" ")}
        >
          Estudiante
        </button>
      </div>

      {/* Mensaje guía */}
      <p className="mt-4 text-xs text-slate-600">
        {role === "admin" ? (
          <>
            <span className="font-semibold text-slate-800">Administrador:</span>{" "}
            Ingresa con tu correo institucional (@soy.sena.edu.co o @sena.edu.co).
          </>
        ) : (
          <>
            <span className="font-semibold text-slate-800">Estudiante:</span>{" "}
            Ingresa con tu documento. Tu contraseña inicial puede ser los últimos 4 dígitos (según política).
          </>
        )}
      </p>

      {/* FORM (tu lógica backend NO se toca) */}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">

        {/* Username / Documento */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-800">
            {role === "admin" ? "Correo institucional" : "Documento de identidad"}
          </label>

          <input
            className="w-full h-12 rounded-2xl border px-4 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
            placeholder={role === "admin" ? "admin@sena.edu.co" : "Ingresa tu cédula o documento"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            inputMode={role === "student" ? "numeric" : "email"}
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-800">Contraseña</label>
          <input
            type="password"
            className="w-full h-12 rounded-2xl border px-4 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 bg-slate-50"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>

        {/* Forgot password */}
        <div className="text-center text-sm text-slate-600">
          <a href="/auth/forgot" className="text-emerald-700 hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        {/* Footer help */}
        <div className="text-center text-xs text-slate-500 pt-2">
          ¿Problemas con tu acceso? Contacta administración.
        </div>

      </form>
    </div>
  </main>
);


}
