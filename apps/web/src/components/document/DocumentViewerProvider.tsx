"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";

const DocumentViewerCanvas = dynamic(() => import("@/components/document/DocumentViewerCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white/70 text-sm text-slate-500">
      Cargando visor de documentos...
    </div>
  ),
});

export type ViewerDocument = {
  uri: string;
  fileType?: string;
  fileName?: string;
  title?: string;
  description?: string;
};

type DocumentViewerContextValue = {
  openDocument: (document: ViewerDocument) => void;
  closeDocument: () => void;
};

const DocumentViewerContext = createContext<DocumentViewerContextValue>({
  openDocument: () => {},
  closeDocument: () => {},
});

const DOC_VIEWER_CONFIG = {
  header: {
    disableHeader: true,
    disableFileName: true,
  },
  pdfZoom: {
    defaultZoom: 1,
    zoomJump: 0.15,
  },
} as const;

const OFFICE_FILE_TYPES = new Set([
  "doc",
  "docx",
  "odt",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function inferExtension(uri: string) {
  const cleanUri = uri.split("?")[0]?.split("#")[0] ?? "";
  const segments = cleanUri.split(".");
  return segments.length > 1 ? (segments.at(-1) || "").toLowerCase() : "";
}

function isOfficeDocument(document: ViewerDocument | null) {
  if (!document) return false;
  const normalizedType = (document.fileType || "").toLowerCase();
  const extension = inferExtension(document.uri);
  return OFFICE_FILE_TYPES.has(normalizedType) || OFFICE_FILE_TYPES.has(extension);
}

function isPublicHttpUrl(uri: string) {
  return /^https?:\/\//i.test(uri);
}

export function DocumentViewerProvider({ children }: { children: React.ReactNode }) {
  const [activeDocument, setActiveDocument] = useState<ViewerDocument | null>(null);

  const openDocument = useCallback((documentToOpen: ViewerDocument) => {
    setActiveDocument(documentToOpen);
  }, []);

  const closeDocument = useCallback(() => {
    setActiveDocument(null);
  }, []);

  useEffect(() => {
    if (!activeDocument) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDocument();
    };

    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeDocument, closeDocument]);

  const contextValue = useMemo<DocumentViewerContextValue>(
    () => ({
      openDocument,
      closeDocument,
    }),
    [closeDocument, openDocument]
  );

  const officeDocument = isOfficeDocument(activeDocument);
  const needsPublicUrlNotice = officeDocument && activeDocument ? !isPublicHttpUrl(activeDocument.uri) : false;
  const dialogTitle = activeDocument?.title || activeDocument?.fileName || "Vista previa de documento";
  const dialogDescription =
    activeDocument?.description ||
    (officeDocument
      ? "Los archivos Office se renderizan mediante Microsoft Office Online y requieren una URL publica accesible."
      : "Vista previa integrada para documentos compatibles.");

  return (
    <DocumentViewerContext.Provider value={contextValue}>
      {children}

      {activeDocument ? (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={dialogTitle}
        >
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.98))] shadow-[0_24px_80px_rgba(15,23,42,0.35)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">{dialogTitle}</h2>
                    <p className="mt-0.5 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{dialogDescription}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <a
                  href={activeDocument.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir aparte
                </a>
                <button
                  type="button"
                  onClick={closeDocument}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <X className="h-4 w-4" />
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100/75 p-4 dark:bg-slate-950/60 sm:p-6">
              {needsPublicUrlNotice ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
                  Este tipo de archivo necesita una URL publica http/https para que Microsoft Office Online pueda renderizarlo.
                </div>
              ) : null}

              <div className="h-full min-h-[60vh] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950">
                <DocumentViewerCanvas
                  activeDocument={activeDocument}
                  config={DOC_VIEWER_CONFIG}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DocumentViewerContext.Provider>
  );
}

export function useDocumentViewer() {
  return useContext(DocumentViewerContext);
}
