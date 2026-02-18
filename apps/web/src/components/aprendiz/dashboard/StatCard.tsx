function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function StatCard({
  label,
  value,
  icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
  loading?: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/90 bg-white/80 p-4 shadow-[0_8px_24px_rgba(2,6,23,0.05)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(2,6,23,0.08)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/85 to-cyan-500/80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          {loading ? (
            <div className="sadi-skeleton mt-2 h-9 w-14 rounded-xl" />
          ) : (
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{value}</p>
          )}
        </div>
        <span
          className={cx(
            "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            tone === "ok" && "bg-sky-100 text-sky-700",
            tone === "warn" && "bg-amber-100 text-amber-700",
            tone === "danger" && "bg-red-100 text-red-700",
            tone === "default" && "bg-cyan-100 text-cyan-700"
          )}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

