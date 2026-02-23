function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost";
type Accent = "sky" | "emerald";

export default function Button({
  children,
  variant = "secondary",
  accent = "sky",
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
        variant === "primary" &&
          (accent === "emerald"
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-105 focus-visible:ring-emerald-500/60"
            : "bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:brightness-105 focus-visible:ring-sky-500/60"),
        variant === "secondary" &&
          "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 focus-visible:ring-zinc-400/40",
        variant === "ghost" &&
          (accent === "emerald"
            ? "text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-500/50"
            : "text-sky-700 hover:bg-sky-50 focus-visible:ring-sky-500/50"),
        props.disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}
