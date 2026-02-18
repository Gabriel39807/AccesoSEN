function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function BadgeChip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "danger" | "info" | "warning" | "purple";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "info" && "border-cyan-200 bg-cyan-50 text-cyan-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "purple" && "border-purple-200 bg-purple-50 text-purple-800",
        tone === "neutral" && "border-zinc-200 bg-zinc-100 text-zinc-700"
      )}
    >
      {children}
    </span>
  );
}
