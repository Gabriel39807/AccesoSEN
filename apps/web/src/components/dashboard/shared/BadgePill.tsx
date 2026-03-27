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
        "inline-flex items-center rounded-full border px-2.5 py-[0.3rem] text-[10.5px] font-semibold leading-none",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
        tone === "info" && "border-teal-200 bg-teal-50 text-teal-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "purple" && "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
        tone === "neutral" && "border-zinc-200 bg-zinc-100 text-zinc-700"
      )}
    >
      {children}
    </span>
  );
}
