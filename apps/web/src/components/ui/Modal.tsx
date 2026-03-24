"use client";

import { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
  closeDisabled?: boolean;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  maxWidthClassName = "max-w-3xl",
  closeDisabled = false,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className={`flex w-full ${maxWidthClassName} max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[1.5rem] border border-surface-border bg-surface shadow-2xl sm:max-h-[calc(100dvh-2rem)]`}>
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
          <h2 className="text-lg font-semibold tracking-tight text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-sm font-medium text-text/80 transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar
          </button>
          </div>
          <div className="min-h-0 px-4 py-4 sm:px-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
