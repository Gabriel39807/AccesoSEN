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
    } catch (e: any) {
      setMsg(toErrorMessage(e, "No se pudo registrar el equipo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <p className="font-semibold">Registrar nuevo equipo</p>
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline">
            Cerrar
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Serial (único)"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Marca (HP, Lenovo...)"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
          />
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Modelo (ThinkPad, Pavilion...)"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
          />

          {msg && <div className="text-sm border rounded-xl p-3 bg-gray-50">{msg}</div>}
        </div>

        <div className="p-4 border-t">
          <button
            disabled={loading}
            onClick={crear}
            className="w-full rounded-xl bg-green-700 text-white py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Registrando..." : "Registrar"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            El equipo quedará en estado <span className="font-medium">pendiente</span> hasta que administración lo apruebe.
          </p>
        </div>
      </div>
    </div>
  );
}
