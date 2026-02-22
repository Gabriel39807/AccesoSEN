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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className={`w-full ${maxWidthClassName} overflow-hidden rounded-3xl border border-surface-border bg-surface shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
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
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
