"use client";

import Link from "next/link";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SidebarItem({
  href,
  label,
  icon,
  active,
  secondary = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex h-11 shrink-0 items-center gap-3 overflow-hidden rounded-2xl border px-3.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none",
        active
          ? "sadi-nav-active border-transparent"
          : secondary
            ? "border-transparent bg-transparent text-[color:var(--text-muted)] hover:border-surface-border hover:bg-surface-muted/65 hover:text-foreground"
            : "sadi-nav-idle border-transparent"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cx(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition",
          active
            ? "sadi-nav-icon"
            : secondary
              ? "bg-surface-muted text-[color:var(--text-muted)] group-hover:bg-surface-elevated"
              : "sadi-nav-icon"
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
