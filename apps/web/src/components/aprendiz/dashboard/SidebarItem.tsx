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
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  secondary?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex shrink-0 items-center overflow-visible rounded-[1.15rem] border text-sm font-semibold transition-all duration-300 focus-visible:outline-none",
        collapsed ? "h-[3.2rem] justify-center px-2.5" : "h-12 gap-3 px-3.5",
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
          "absolute rounded-full transition-all duration-300",
          collapsed ? "left-1/2 top-1 h-[3px] w-6 -translate-x-1/2" : "inset-y-2 left-1 w-1",
          active ? "bg-[color:var(--primary)] opacity-100" : "bg-transparent opacity-0",
        )}
      />
      <span
        className={cx(
          "inline-flex shrink-0 items-center justify-center rounded-[0.95rem] transition-all duration-300",
          collapsed ? "h-9 w-9" : "h-8 w-8",
          active
            ? "sadi-nav-icon"
            : secondary
              ? "bg-surface-muted text-[color:var(--text-muted)] group-hover:bg-surface-elevated"
              : "sadi-nav-icon"
        )}
      >
        {icon}
      </span>
      <span
        className={cx(
          "truncate tracking-[-0.01em] transition-all duration-200",
          collapsed ? "w-0 translate-x-1 opacity-0 pointer-events-none" : "w-auto opacity-100",
        )}
      >
        {label}
      </span>
      {collapsed ? (
        <span className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-[0.9rem] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-elevated)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--color-text)] opacity-0 shadow-[0_16px_28px_rgba(15,23,42,0.14)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
          {label}
        </span>
      ) : null}
    </Link>
  );
}
