"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function PrimerAccesoPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg("La nueva contrasena debe tener minimo 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setMsg("Las contrasenas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/change-initial-password/", {
        current_password: current,
        new_password: next,
      });
      router.replace("/aprendiz/inicio");
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-extrabold text-zinc-900">Primer ingreso</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Debes cambiar la contrasena inicial (ultimos 4 o 6 digitos del documento).
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Contrasena actual"
          className="w-full rounded-2xl border px-4 py-3 text-sm"
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Nueva contrasena"
          className="w-full rounded-2xl border px-4 py-3 text-sm"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmar contrasena"
          className="w-full rounded-2xl border px-4 py-3 text-sm"
        />

        {msg && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>}

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar contrasena"}
        </button>
      </form>
    </div>
  );
}
