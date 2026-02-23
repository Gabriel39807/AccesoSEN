"use client";

import { useMemo, useState } from "react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function FaqItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_6px_18px_rgba(2,6,23,0.04)] transition hover:shadow-[0_10px_22px_rgba(2,6,23,0.06)]">
      <summary className="cursor-pointer list-none text-base font-bold tracking-tight text-zinc-900">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 transition group-open:rotate-45">
            +
          </span>
          {title}
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-zinc-700">{children}</div>
    </details>
  );
}

export default function AprendizAyudaPage() {
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState("Otro motivo");

  const mailto = useMemo(() => {
    const to = "soporte@sena.edu.co";
    const subject = encodeURIComponent(`[SADI] ${motivo}: ${asunto}`.trim());
    const body = encodeURIComponent(mensaje);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [asunto, mensaje, motivo]);

  const canSend = asunto.trim().length > 0 && mensaje.trim().length > 0;
  const charsLeft = Math.max(0, 500 - mensaje.length);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_12px_34px_rgba(2,6,23,0.07)] backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-20 -top-14 h-48 w-48 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Centro de soporte</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">Ayuda y soporte</h2>
          <p className="mt-1 text-sm text-zinc-600">Resuelve dudas frecuentes o envia un caso al equipo de soporte.</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Preguntas frecuentes</h3>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Respuestas rapidas
            </span>
          </div>

          <div className="space-y-3">
            <FaqItem title="Como registro un equipo nuevo?">
              <ol className="list-decimal space-y-1 pl-5">
                <li>Ingresa a <span className="font-semibold">Mis equipos</span>.</li>
                <li>Selecciona <span className="font-semibold">Registrar nuevo</span>.</li>
                <li>Completa Serial, Marca y Modelo, luego guarda.</li>
              </ol>
            </FaqItem>

            <FaqItem title="Como actualizo mi foto o numero de telefono?">
              Esta opcion depende de la configuracion del backend. Si no puedes editar estos datos en perfil,
              solicita actualizacion al area administrativa.
            </FaqItem>

            <FaqItem title="Olvide mi contraseÃ±a">
              Ve a la opcion de recuperacion de contraseÃ±a en login, o contacta administracion con tu documento para
              restablecer acceso.
            </FaqItem>
          </div>
        </section>

        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-4">
          <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Contactar soporte</h3>
          <p className="mt-1 text-sm text-zinc-600">Completa el formulario y abriremos tu caso por correo.</p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Motivo</label>
              <select
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                <option>Otro motivo</option>
                <option>Olvide mi contraseÃ±a</option>
                <option>Problemas para registrar equipo</option>
                <option>Datos personales</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Asunto</label>
              <input
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: No puedo iniciar sesion"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Mensaje</label>
                <span className="text-[11px] font-semibold text-zinc-500">{charsLeft} caracteres restantes</span>
              </div>
              <textarea
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                rows={5}
                maxLength={500}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Describe el problema con el mayor detalle posible..."
              />
            </div>

            <a
              href={mailto}
              className={cx(
                "block rounded-2xl px-5 py-3 text-center text-sm font-semibold transition",
                canSend
                  ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-[0_10px_22px_rgba(5,150,105,0.28)] hover:brightness-105"
                  : "pointer-events-none bg-zinc-200 text-zinc-500"
              )}
            >
              Enviar mensaje
            </a>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-zinc-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Otros canales</div>
            <div className="mt-2 space-y-1.5">
              <div>
                <span className="font-semibold">Linea de atencion:</span> (000) 000 0000
              </div>
              <div>
                <span className="font-semibold">Correo:</span> soporte@sena.edu.co
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

