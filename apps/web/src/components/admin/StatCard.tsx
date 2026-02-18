function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  loading,
  onClick,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "info" | "warning" | "purple";
  loading?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <article className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_8px_24px_rgba(2,6,23,0.05)]">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-1",
          tone === "success" && "bg-gradient-to-r from-emerald-500 to-teal-500",
          tone === "danger" && "bg-gradient-to-r from-red-500 to-rose-500",
          tone === "info" && "bg-gradient-to-r from-cyan-500 to-sky-500",
          tone === "warning" && "bg-gradient-to-r from-amber-500 to-orange-500",
          tone === "purple" && "bg-gradient-to-r from-purple-500 to-fuchsia-500",
          tone === "neutral" && "bg-gradient-to-r from-slate-500 to-zinc-500"
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          {loading ? <div className="sadi-skeleton mt-2 h-8 w-14 rounded-xl" /> : <p className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{value}</p>}
        </div>
        {icon ? <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">{icon}</span> : null}
      </div>
    </article>
  );

  if (!onClick) return body;
  return (
    <button
      onClick={onClick}
      className="text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
    >
      {body}
    </button>
  );
}
