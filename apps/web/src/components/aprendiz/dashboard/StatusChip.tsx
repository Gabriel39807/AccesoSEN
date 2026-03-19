"use client";

type StatusChipState = "DENTRO" | "FUERA" | "SIN_REGISTROS" | string | undefined;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusClasses(status: StatusChipState) {
  const base = "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition";
  if (status === "DENTRO") {
    return `${base} border-[color:color-mix(in_srgb,var(--success)_26%,var(--surface-border))] bg-[color:color-mix(in_srgb,var(--success)_14%,var(--surface-elevated))] text-[color:color-mix(in_srgb,var(--success)_72%,var(--foreground))]`;
  }
  if (status === "FUERA") {
    return `${base} border-[color:color-mix(in_srgb,var(--warning)_28%,var(--surface-border))] bg-[color:color-mix(in_srgb,var(--warning)_14%,var(--surface-elevated))] text-[color:color-mix(in_srgb,var(--warning)_78%,var(--foreground))]`;
  }
  return `${base} border-surface-border bg-surface-muted/90 text-[color:var(--text-soft)]`;
}

function statusLabel(status: StatusChipState) {
  if (status === "DENTRO") return "Dentro del centro";
  if (status === "FUERA") return "Fuera del centro";
  return "Sin registros";
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
          safeStatus === "DENTRO" && "animate-pulse bg-[color:var(--success)]",
          safeStatus === "FUERA" && "animate-pulse bg-[color:var(--warning)]",
          safeStatus !== "DENTRO" && safeStatus !== "FUERA" && "bg-[color:var(--text-faint)]"
        )}
      />
      <span className="whitespace-nowrap">
        {labelPrefix ? `${labelPrefix}: ${statusLabel(safeStatus)}` : statusLabel(safeStatus)}
      </span>
    </span>
  );
}
