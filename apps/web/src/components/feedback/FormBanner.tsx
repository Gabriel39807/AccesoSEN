"use client";

import { ReactNode } from "react";

type BannerType = "error" | "success" | "warning" | "info";

type FormBannerProps = {
  type: BannerType;
  title?: string;
  message: string;
  actions?: ReactNode;
  className?: string;
};

function toneClasses(type: BannerType) {
  if (type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (type === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (type === "info") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default function FormBanner({ type, title, message, actions, className = "" }: FormBannerProps) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${toneClasses(type)} ${className}`.trim()} role="status" aria-live="polite">
      {title ? <div className="font-semibold">{title}</div> : null}
      <div>{message}</div>
      {actions ? <div className="mt-2">{actions}</div> : null}
    </div>
  );
}

