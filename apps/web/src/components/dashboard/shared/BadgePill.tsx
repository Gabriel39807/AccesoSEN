function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export type BadgeTone = "neutral" | "success" | "danger" | "info" | "warning" | "purple";

export default function BadgePill({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "success" && "border-sky-200 bg-sky-50 text-sky-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "info" && "border-cyan-200 bg-cyan-50 text-cyan-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "purple" && "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
        tone === "neutral" && "border-zinc-200 bg-zinc-100 text-zinc-700"
      )}
    >
      {children}
    </span>
  );
}

