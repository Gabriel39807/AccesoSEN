function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost";
type Accent = "sky" | "emerald";

export default function Button({
  children,
  variant = "secondary",
  accent = "emerald",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  accent?: Accent;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
        variant === "primary" &&
          (accent === "emerald"
            ? "border border-[color:color-mix(in_srgb,var(--primary)_42%,var(--surface-border))] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_94%,white),color-mix(in_srgb,var(--primary-strong)_92%,black))] text-[color:var(--primary-contrast)] shadow-[0_16px_30px_color-mix(in_srgb,var(--primary)_18%,transparent)] hover:brightness-105 focus-visible:ring-emerald-500/40"
            : "bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:brightness-105 focus-visible:ring-sky-500/60"),
        variant === "secondary" &&
          "border border-[color:var(--surface-border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-soft)] hover:border-[color:var(--surface-border-strong)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)] focus-visible:ring-[color:color-mix(in_srgb,var(--primary)_22%,transparent)]",
        variant === "ghost" &&
          (accent === "emerald"
            ? "text-[color:var(--primary-strong)] hover:bg-[color:var(--primary-soft)] focus-visible:ring-emerald-500/30"
            : "text-[color:var(--primary-strong)] hover:bg-[color:var(--primary-soft)] focus-visible:ring-emerald-500/30"),
        props.disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}
