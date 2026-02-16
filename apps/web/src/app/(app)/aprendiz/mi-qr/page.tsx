"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type QrResponse = {
  permitido: boolean;
  motivo: string | null;
  qr_value: string;
  documento: string;
  algoritmo: string;
  qr_png_base64: string;
};

export default function MiQrPage() {
  const [doc, setDoc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pngBase64, setPngBase64] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.get<QrResponse>("/api/aprendiz/mi-qr/");
        if (!mounted) return;
        setDoc(r.data.documento);
        setPngBase64(r.data.qr_png_base64);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo cargar tu QR.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function downloadQr() {
    try {
      const r = await api.get("/api/aprendiz/mi-qr/descargar/", { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `sadi-mi-qr-${doc || "aprendiz"}.png`;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.response?.data?.motivo || "No se pudo descargar el QR.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-zinc-900">Mi QR</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Este codigo esta firmado digitalmente para reducir falsificacion.
        </p>
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        {loading && <p className="text-sm text-zinc-600">Cargando QR...</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Documento</div>
              <div className="mt-1 font-semibold text-zinc-900">{doc}</div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <img src={`data:image/png;base64,${pngBase64}`} alt="Mi QR SADI" className="mx-auto h-72 w-72" />
            </div>

            <button
              onClick={downloadQr}
              className="inline-block rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Descargar QR (offline)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
