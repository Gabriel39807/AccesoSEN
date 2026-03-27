import Link from "next/link";

import { IconArrowRight } from "./DashboardIcons";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function QuickActionCard({
  href,
  title,
  description,
  icon,
  featured,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex min-h-[120px] flex-col justify-between rounded-2xl border p-4 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",
        featured
          ? "border-sky-300/60 bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-[0_14px_28px_rgba(8,47,73,0.35)] hover:brightness-105"
          : "border-surface-border bg-[color:var(--surface-elevated)] text-foreground shadow-[0_12px_24px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)] hover:shadow-[0_16px_30px_rgba(0,0,0,0.24)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            featured ? "bg-white/18 text-white" : "bg-sky-100 text-sky-700",
          )}
        >
          {icon}
        </span>
        <IconArrowRight
          className={cx(
            "h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5",
            featured ? "text-white/90" : "text-[color:var(--text-muted)] group-hover:text-sky-700",
          )}
        />
      </div>

      <div className="mt-4">
        <div className="text-sm font-extrabold tracking-tight">{title}</div>
        <p className={cx("mt-1 text-xs", featured ? "text-white/90" : "text-[color:var(--text-soft)]")}>
          {description}
        </p>
      </div>
    </Link>
  );
}
