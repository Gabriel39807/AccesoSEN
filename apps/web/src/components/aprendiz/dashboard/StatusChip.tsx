"use client";

type StatusChipState = "DENTRO" | "FUERA" | "SIN_REGISTROS" | string | undefined;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusClasses(status: StatusChipState) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition";
  if (status === "DENTRO") {
    return `${base} border-sky-200/90 bg-sky-50/80 text-sky-800`;
  }
  if (status === "FUERA") {
    return `${base} border-cyan-200/90 bg-cyan-50/80 text-cyan-800`;
  }
  return `${base} border-zinc-200/90 bg-zinc-100/80 text-zinc-700`;
}

export default function StatusChip({
  status,
  labelPrefix,
}: {
  status?: StatusChipState;
  labelPrefix?: string;
}) {
  const safeStatus = status ?? "SIN_REGISTROS";
  return (
    <span className={statusClasses(safeStatus)}>
      <span
        className={cx(
          "inline-flex h-2.5 w-2.5 rounded-full",
          safeStatus === "DENTRO" && "bg-sky-500 animate-pulse",
          safeStatus === "FUERA" && "bg-cyan-500 animate-pulse",
          safeStatus !== "DENTRO" && safeStatus !== "FUERA" && "bg-zinc-400"
        )}
      />
      <span className="whitespace-nowrap">
        {labelPrefix ? `${labelPrefix}: ${safeStatus}` : safeStatus}
      </span>
    </span>
  );
}

