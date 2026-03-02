"use client";

import { ReactNode } from "react";

type InlineNoticeType = "error" | "success" | "warning" | "info";

type InlineNoticeProps = {
  type?: InlineNoticeType;
  message: string;
  className?: string;
  children?: ReactNode;
};

function textTone(type: InlineNoticeType) {
  if (type === "success") return "text-emerald-700";
  if (type === "warning") return "text-amber-700";
  if (type === "info") return "text-sky-700";
  return "text-rose-600";
}

export default function InlineNotice({ type = "info", message, className = "", children }: InlineNoticeProps) {
  return (
    <div className={`text-[11px] ${textTone(type)} ${className}`.trim()}>
      <span>{message}</span>
      {children}
    </div>
  );
}
