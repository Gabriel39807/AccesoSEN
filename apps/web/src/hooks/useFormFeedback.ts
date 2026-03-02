"use client";

import { useCallback, useMemo, useState } from "react";
import { ParsedApiError, parseApiError } from "@/lib/apiError";

export type FeedbackType = "error" | "success" | "warning" | "info";

export type FeedbackBanner = {
  type: FeedbackType;
  message: string;
  title?: string;
};

type RefLike = { current: HTMLElement | null } | HTMLElement | null | undefined;

type RefMap = Record<string, RefLike>;

function resolveElement(target: RefLike): HTMLElement | null {
  if (!target) return null;
  if ("current" in (target as any)) {
    return ((target as { current: HTMLElement | null }).current ?? null) as HTMLElement | null;
  }
  return target as HTMLElement;
}

export function useFormFeedback() {
  const [banner, setBanner] = useState<FeedbackBanner | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearBanner = useCallback(() => setBanner(null), []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => setFieldErrors({}), []);

  const setFromApiError = useCallback(
    (err: unknown, fallbackMessage = "No se pudo completar la acción. Intenta nuevamente.") => {
      const parsed: ParsedApiError = parseApiError(err);
      setFieldErrors(parsed.fieldErrors ?? {});
      setBanner({
        type: "error",
        message: parsed.message || fallbackMessage,
      });
      return parsed;
    },
    [],
  );

  const focusFirstError = useCallback(
    (refMap?: RefMap) => {
      if (!refMap) return;
      for (const field of Object.keys(fieldErrors)) {
        const node = resolveElement(refMap[field]);
        if (node && typeof node.focus === "function") {
          node.focus();
          break;
        }
      }
    },
    [fieldErrors],
  );

  return useMemo(
    () => ({
      banner,
      setBanner,
      clearBanner,
      fieldErrors,
      setFieldErrors,
      clearFieldError,
      clearAllFieldErrors,
      setFromApiError,
      focusFirstError,
    }),
    [
      banner,
      clearBanner,
      clearFieldError,
      clearAllFieldErrors,
      fieldErrors,
      focusFirstError,
      setFromApiError,
    ],
  );
}

