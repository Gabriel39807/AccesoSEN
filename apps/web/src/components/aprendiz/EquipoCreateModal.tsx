"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";

export default function EquipoCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serial, setSerial] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) return null;

  async function crear() {
    setMsg(null);
    if (!serial.trim() || !marca.trim() || !modelo.trim()) {
      setMsg("Completa serial, marca y modelo.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/equipos/", {
        serial: serial.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
      });
      setSerial("");
      setMarca("");
      setModelo("");
      onCreated();
    } catch (e: unknown) {
      setMsg(toErrorMessage(e, "No se pudo registrar el equipo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-surface-border bg-[color:var(--surface-elevated)] shadow-[0_22px_48px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between border-b border-surface-border p-4">
          <p className="font-semibold text-foreground">Registrar nuevo equipo</p>
          <button onClick={onClose} className="text-sm text-[color:var(--text-soft)] transition hover:text-foreground">
            Cerrar
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            className="command-noir-control h-auto rounded-xl p-3"
            placeholder="Serial (unico)"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
          <input
            className="command-noir-control h-auto rounded-xl p-3"
            placeholder="Marca (HP, Lenovo...)"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
          />
          <input
            className="command-noir-control h-auto rounded-xl p-3"
            placeholder="Modelo (ThinkPad, Pavilion...)"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
          />

          {msg ? <div className="rounded-xl border border-surface-border bg-[color:var(--surface-muted)] p-3 text-sm text-[color:var(--text-soft)]">{msg}</div> : null}
        </div>

        <div className="border-t border-surface-border p-4">
          <button
            disabled={loading}
            onClick={crear}
            className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Registrando..." : "Registrar"}
          </button>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            El equipo quedara en estado <span className="font-medium text-[color:var(--text-soft)]">pendiente</span> hasta que administracion lo apruebe.
          </p>
        </div>
      </div>
    </div>
  );
}
