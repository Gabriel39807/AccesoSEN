"use client";
import { motion } from "framer-motion";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type StatTone = "default" | "ok" | "warn" | "danger" | "success" | "info" | "warning" | "purple" | "neutral";

function normalizeTone(tone: StatTone): "default" | "ok" | "warn" | "danger" | "info" | "purple" | "neutral" {
  if (tone === "success") return "ok";
  if (tone === "warning") return "warn";
  return tone as "default" | "ok" | "warn" | "danger" | "info" | "purple" | "neutral";
}

export default function StatCard({
  label,
  value,
  icon,
  tone = "default",
  loading,
  onClick,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: StatTone;
  loading?: boolean;
  onClick?: () => void;
}) {
  const t = normalizeTone(tone);
  const body = (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="group relative overflow-hidden rounded-2xl border border-white/90 bg-white/80 p-4 shadow-[0_8px_24px_rgba(2,6,23,0.05)] backdrop-blur-sm hover:shadow-[0_10px_30px_rgba(2,6,23,0.08)]"
    >
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-1",
          t === "ok" && "bg-gradient-to-r from-sky-500/90 to-cyan-500/90",
          t === "warn" && "bg-gradient-to-r from-amber-500/90 to-orange-500/90",
          t === "danger" && "bg-gradient-to-r from-red-500/90 to-rose-500/90",
          t === "info" && "bg-gradient-to-r from-cyan-500/90 to-sky-500/90",
          t === "purple" && "bg-gradient-to-r from-fuchsia-500/90 to-purple-500/90",
          (t === "neutral" || t === "default") && "bg-gradient-to-r from-zinc-500/90 to-slate-500/90"
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          {loading ? <div className="sadi-skeleton mt-2 h-9 w-16 rounded-xl" /> : <p className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{value}</p>}
        </div>
        {icon ? (
          <span
            className={cx(
              "inline-flex h-10 w-10 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-105",
              t === "ok" && "bg-sky-100 text-sky-700",
              t === "warn" && "bg-amber-100 text-amber-700",
              t === "danger" && "bg-red-100 text-red-700",
              t === "info" && "bg-cyan-100 text-cyan-700",
              t === "purple" && "bg-fuchsia-100 text-fuchsia-700",
              (t === "neutral" || t === "default") && "bg-zinc-100 text-zinc-700"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </motion.article>
  );

  if (!onClick) return body;
  return (
    <button
      onClick={onClick}
      className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
    >
      {body}
    </button>
  );
}
