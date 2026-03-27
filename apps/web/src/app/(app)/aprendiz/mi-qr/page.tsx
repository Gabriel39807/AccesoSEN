"use client";

import Image from "next/image";
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

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      motivo?: string;
    };
  };
};

function downloadQr(base64: string, doc: string) {
  if (!base64) return;
  const a = document.createElement("a");
  a.href = `data:image/png;base64,${base64}`;
  a.download = `mi-qr-${doc || "aprendiz"}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function MiQrPage() {
  const [doc, setDoc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [pngBase64, setPngBase64] = useState<string>("");
  const [copied, setCopied] = useState(false);

  async function loadQr(isSoftReload = false) {
    if (isSoftReload) setReloading(true);
    else setLoading(true);
    setError(null);
    try {
      const r = await api.get<QrResponse>("/api/aprendiz/mi-qr/");
      setDoc(r.data.documento);
      setPngBase64(r.data.qr_png_base64);
    } catch (e: unknown) {
      const err = e as ApiErrorShape;
      setError(err.response?.data?.message || err.response?.data?.motivo || "No se pudo cargar tu QR.");
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  useEffect(() => {
    loadQr(false);
  }, []);

  async function copyDoc() {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(doc);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_12px_34px_rgba(2,6,23,0.07)] backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-24 -top-16 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Acceso inteligente</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">Mi QR de acceso</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Presenta este codigo en porteria para validar tu ingreso y salida de forma rapida y segura.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)] backdrop-blur-sm sm:p-6">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="sadi-skeleton h-[320px] rounded-2xl lg:col-span-8" />
            <div className="space-y-3 lg:col-span-4">
              <div className="sadi-skeleton h-24 rounded-2xl" />
              <div className="sadi-skeleton h-24 rounded-2xl" />
              <div className="sadi-skeleton h-24 rounded-2xl" />
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-sm text-red-700">
            <div className="font-semibold">No pudimos cargar tu QR.</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50 to-sky-50/40 p-4 lg:col-span-8">
              <div className="pointer-events-none absolute -right-14 top-12 h-40 w-40 rounded-full bg-sky-200/35 blur-3xl" />
              <div className="pointer-events-none absolute -left-8 bottom-3 h-32 w-32 rounded-full bg-cyan-200/35 blur-3xl" />
              <div className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.75)]">
                <Image
                  src={`data:image/png;base64,${pngBase64}`}
                  alt="Mi QR SADI"
                  width={340}
                  height={340}
                  unoptimized
                  className="mx-auto aspect-square h-[260px] w-[260px] sm:h-[340px] sm:w-[340px]"
                />
              </div>
              <p className="mt-3 text-center text-xs font-medium text-zinc-500">
                Mantener visible y sin recortes al escanear.
              </p>
            </div>

            <div className="space-y-3 lg:col-span-4">
              <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-cyan-50/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Documento</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">{doc}</p>
                <p className="mt-2 text-xs text-zinc-600">Identificador asociado a este codigo QR.</p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(2,6,23,0.04)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Acciones</p>
                  <button
                    onClick={() => loadQr(true)}
                    disabled={reloading}
                    className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
                  >
                    {reloading ? "Recargando..." : "Recargar"}
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={() => downloadQr(pngBase64, doc)}
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.28)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                  >
                    Descargar QR
                  </button>
                  <button
                    onClick={copyDoc}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                  >
                    {copied ? "Documento copiado" : "Copiar documento"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-xs text-zinc-600">
                Comparte este QR solo al momento del registro de acceso. Evita capturas innecesarias.
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

