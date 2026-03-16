"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AprendizNuevoEquipoPage() {
  const router = useRouter();

  const [serial, setSerial] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTipo, setMsgTipo] = useState<"ok" | "err" | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setMsgTipo(null);

    if (!serial.trim() || !marca.trim() || !modelo.trim()) {
      setMsg("Completa serial, marca y modelo.");
      setMsgTipo("err");
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/equipos/", {
        serial: serial.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
      });

      setMsg("Equipo registrado. Queda en estado pendiente hasta su revisión.");
      setMsgTipo("ok");

      setTimeout(() => router.push("/aprendiz/equipos"), 450);
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo registrar el equipo."));
      setMsgTipo("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="rounded-3xl border bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="text-lg font-extrabold text-zinc-900">Registrar equipo</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Ingresa los datos del equipo tecnológico que llevarás al centro.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-zinc-700">Serial</label>
              <input
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                placeholder="Ej: ABC1234"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">Debe ser único.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700">Marca</label>
              <input
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                placeholder="Ej: HP, Lenovo, Dell"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-700">Modelo</label>
              <input
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                placeholder="Ej: Pavilion 15"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              disabled={saving}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Registrando..." : "Registrar equipo"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>

          {msg && (
            <div
              className={cx(
                "rounded-2xl border p-4 text-sm",
                msgTipo === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                msgTipo === "err" && "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {msg}
            </div>
          )}
        </form>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-zinc-900">Recomendaciones</h3>
        <ul className="mt-4 space-y-3 text-sm text-zinc-700">
          <li className="rounded-2xl border bg-zinc-50 p-4">
            Verifica el <span className="font-semibold">serial</span> antes de guardar.
          </li>
          <li className="rounded-2xl border bg-zinc-50 p-4">
            Una vez registrado, el equipo queda <span className="font-semibold">pendiente</span> de revisión.
          </li>
          <li className="rounded-2xl border bg-zinc-50 p-4">
            Regístralo <span className="font-semibold">antes</span> de llegar a portería para evitar filas.
          </li>
        </ul>
      </div>
    </div>
  );
}
