"use client";

import { useMemo, useState } from "react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function AprendizAyudaPage() {
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState("Otro motivo");

  const mailto = useMemo(() => {
    const to = "soporte@sena.edu.co"; // ajusta si tu proyecto tiene otro correo
    const subject = encodeURIComponent(`[AccesoSEN] ${motivo}: ${asunto}`.trim());
    const body = encodeURIComponent(mensaje);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [asunto, mensaje, motivo]);

  const canSend = asunto.trim().length > 0 && mensaje.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-zinc-900">Ayuda y soporte</h2>
        <p className="mt-1 text-sm text-zinc-600">¿Cómo podemos ayudarte?</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* FAQ */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-zinc-900">Preguntas frecuentes</h3>

          <div className="mt-4 space-y-3">
            <details className="rounded-2xl border bg-zinc-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                ¿Cómo registro un equipo nuevo?
              </summary>
              <div className="mt-3 text-sm text-zinc-700">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Ve a <span className="font-semibold">Mis equipos</span>.</li>
                  <li>Haz clic en <span className="font-semibold">Registrar nuevo</span>.</li>
                  <li>Completa los datos (Serial, Marca y Modelo) y guarda.</li>
                </ol>
              </div>
            </details>

            <details className="rounded-2xl border bg-zinc-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                ¿Cómo actualizo mi foto o número de teléfono?
              </summary>
              <div className="mt-3 text-sm text-zinc-700">
                Por ahora, esta opción depende de la configuración del backend.
                Si no puedes editar tu perfil desde el sistema, acércate a administración
                para que actualicen tus datos.
              </div>
            </details>

            <details className="rounded-2xl border bg-zinc-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                Olvidé mi contraseña
              </summary>
              <div className="mt-3 text-sm text-zinc-700">
                Si no recuerdas tus credenciales, contacta a administración con tu
                documento de identidad para restablecer el acceso.
              </div>
            </details>
          </div>
        </div>

        {/* CONTACTO */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-zinc-900">Contactar soporte</h3>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700">Motivo</label>
              <select
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                <option>Otro motivo</option>
                <option>Olvidé mi contraseña</option>
                <option>Problemas para registrar equipo</option>
                <option>Datos personales</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700">Asunto</label>
              <input
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: No puedo iniciar sesión"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700">Mensaje</label>
              <textarea
                className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm"
                rows={5}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Describe el problema con el mayor detalle posible..."
              />
            </div>

            <a
              href={mailto}
              className={cx(
                "block rounded-2xl px-5 py-3 text-center text-sm font-semibold",
                canSend
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-zinc-200 text-zinc-500 pointer-events-none"
              )}
            >
              Enviar mensaje
            </a>
          </div>

          <div className="mt-5 rounded-2xl border bg-zinc-50 p-4 text-sm text-zinc-700">
            <div className="text-xs font-semibold text-zinc-500">Otros canales</div>
            <div className="mt-2 space-y-1">
              <div><span className="font-semibold">Línea de atención:</span> (000) 000 0000</div>
              <div><span className="font-semibold">Correo:</span> soporte@sena.edu.co</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
