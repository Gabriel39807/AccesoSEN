"use client";

import "@cyntler/react-doc-viewer/dist/index.css";

import DocViewer, { DocViewerRenderers, type IDocument, type IConfig } from "@cyntler/react-doc-viewer";

type DocumentViewerCanvasProps = {
  activeDocument: IDocument;
  config: IConfig;
};

export default function DocumentViewerCanvas({ activeDocument, config }: DocumentViewerCanvasProps) {
  return (
    <DocViewer
      documents={[activeDocument]}
      activeDocument={activeDocument}
      config={config}
      pluginRenderers={DocViewerRenderers}
      style={{ height: "100%", width: "100%" }}
      theme={{
        primary: "#0ea5e9",
        secondary: "#e2e8f0",
        tertiary: "#f8fafc",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
        textTertiary: "#64748b",
        disableThemeScrollbar: false,
      }}
    />
  );
}
