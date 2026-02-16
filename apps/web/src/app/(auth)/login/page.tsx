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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Login SADI</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full border rounded-lg p-2"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="w-full border rounded-lg p-2"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={loading} className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-50">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => router.push("/password-recovery")}
          className="mt-3 w-full rounded-lg border p-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Olvide mi contrasena
        </button>
        {error && <p className="text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
