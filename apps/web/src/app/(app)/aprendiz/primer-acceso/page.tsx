"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

export default function PrimerAccesoPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rules = buildPasswordRules(next, confirm);
  const allRulesValid = rules.every((rule) => rule.valid);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!allRulesValid) {
      setMsg("La nueva contrasena no cumple todos los requisitos.");
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
        <div className="rounded-2xl border bg-zinc-50 p-3 text-sm">
          <div className="mb-1 font-semibold text-zinc-900">Checklist de seguridad</div>
          <ul className="space-y-1 text-zinc-600">
            {rules.map((rule) => (
              <li key={rule.id} className={rule.valid ? "text-emerald-700" : "text-zinc-600"}>
                {rule.valid ? "[OK]" : "[ ]"} {rule.label}
              </li>
            ))}
          </ul>
        </div>

        {msg && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>}

        <button
          disabled={loading || !allRulesValid}
          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar contrasena"}
        </button>
      </form>
    </div>
  );
}
