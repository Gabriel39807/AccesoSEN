"use client";

import { Eye, FileText, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { useInstitution } from "@/context/institution-context";
import { useDocumentViewer } from "@/components/document/DocumentViewerProvider";

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
  const { emailPlaceholder } = useInstitution();
  const { openDocument } = useDocumentViewer();
  const supportEmail = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `soporte@${emailPlaceholder.split("@")[1]}`).trim();

  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState("Otro motivo");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("docx");

  const mailto = useMemo(() => {
    const to = supportEmail;
    const subject = encodeURIComponent(`[SADI] ${motivo}: ${asunto}`.trim());
    const body = encodeURIComponent(mensaje);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [asunto, mensaje, motivo, supportEmail]);

  const canSend = asunto.trim().length > 0 && mensaje.trim().length > 0;
  const charsLeft = Math.max(0, 500 - mensaje.length);
  const canPreviewDocument = documentUrl.trim().length > 0;

  function handlePreviewDocument() {
    const trimmedUrl = documentUrl.trim();
    if (!trimmedUrl) return;

    openDocument({
      uri: trimmedUrl,
      fileName: documentName.trim() || undefined,
      fileType: documentType.trim() || undefined,
      title: documentName.trim() || "Documento en vista previa",
      description:
        documentType === "doc" || documentType === "docx" || documentType === "xls" || documentType === "xlsx" || documentType === "ppt" || documentType === "pptx"
          ? "Vista general basada en react-doc-viewer. Los archivos de Office necesitan una URL pública accesible."
          : "Vista general basada en react-doc-viewer para archivos compatibles.",
    });
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_12px_34px_rgba(2,6,23,0.07)] backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-20 -top-14 h-48 w-48 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Centro de soporte</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">Ayuda y soporte</h2>
          <p className="mt-1 text-sm text-zinc-600">Resuelve dudas frecuentes, abre un caso con soporte o prueba la vista previa global de documentos.</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm xl:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">Preguntas frecuentes</h3>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Respuestas rápidas
            </span>
          </div>

          <div className="space-y-3">
            <FaqItem title="¿Cómo registro un equipo nuevo?">
              <ol className="list-decimal space-y-1 pl-5">
                <li>Ingresa a <span className="font-semibold">Mis equipos</span>.</li>
                <li>Selecciona <span className="font-semibold">Registrar nuevo</span>.</li>
                <li>Completa serial, marca y modelo, luego guarda.</li>
              </ol>
            </FaqItem>

            <FaqItem title="¿Cómo actualizo mi foto o número de teléfono?">
              Esta opción depende de la configuración del backend. Si no puedes editar estos datos en perfil,
              solicita la actualización al área administrativa.
            </FaqItem>

            <FaqItem title="Olvidé mi contraseña">
              Ve a la opción de recuperación de contraseña en el inicio de sesión o contacta a administración con tu documento para
              restablecer el acceso.
            </FaqItem>

            <FaqItem title="¿Puedo ver documentos Word o PDF dentro del sistema?">
              Sí. SADI tiene un visor global. Para PDF e imágenes funciona directamente. Para Word, Excel y PowerPoint,
              la URL debe ser pública para que Microsoft Office Online pueda renderizarla dentro del visor.
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
                <option>Olvidé mi contraseña</option>
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
                placeholder="Ej: No puedo iniciar sesión"
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
              Enviar solicitud
            </a>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-zinc-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Otros canales</div>
            <div className="mt-2 space-y-1.5">
              <div>
                <span className="font-semibold">Línea de atención:</span> (000) 000 0000
              </div>
              <div>
                <span className="font-semibold">Correo:</span> {supportEmail}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              <FileText className="h-3.5 w-3.5" />
              Visor global
            </div>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900">Vista previa de documentos</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Este bloque usa la configuración global del visor. Cualquier módulo puede reutilizarla con el hook
              <span className="font-semibold text-zinc-800"> useDocumentViewer()</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:max-w-md">
            <div className="font-semibold">Importante para Word, Excel y PowerPoint</div>
            <p className="mt-1">
              Estos formatos se abren mediante Microsoft Office Online. Usa una URL pública HTTPS; una ruta local o privada no se podrá incrustar.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-white/80 p-4 shadow-[0_8px_22px_rgba(2,6,23,0.04)]">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">URL del documento</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <Globe className="h-4 w-4 shrink-0 text-sky-700" />
                <input
                  className="w-full bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://.../archivo.docx"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Nombre visible</label>
                <input
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Manual de ingreso.docx"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Tipo esperado</label>
                <select
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="docx">Word (.docx)</option>
                  <option value="doc">Word (.doc)</option>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pptx">PowerPoint (.pptx)</option>
                  <option value="txt">Texto (.txt)</option>
                  <option value="image/png">Imagen PNG</option>
                  <option value="image/jpeg">Imagen JPG</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreviewDocument}
                disabled={!canPreviewDocument}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(14,165,233,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                Abrir vista previa
              </button>
              <p className="text-xs text-zinc-500">El visor se abre como modal global y puede reutilizarse en cualquier página.</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 shadow-[0_12px_28px_rgba(2,6,23,0.18)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Notas de compatibilidad</div>
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              <li>PDF, texto e imágenes suelen renderizar sin depender de servicios externos.</li>
              <li>DOC, DOCX, XLS, XLSX, PPT y PPTX necesitan una URL pública accesible desde Internet.</li>
              <li>Si el archivo es privado, el botón “Abrir aparte” del modal sigue disponible para abrir la fuente original.</li>
              <li>La política CSP de la app ya fue actualizada para permitir el iframe del visor de Office.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
