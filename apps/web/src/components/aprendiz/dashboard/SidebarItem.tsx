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
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",
        active
          ? "border-sky-400/45 bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-900/10"
          : "border-transparent bg-white/50 text-zinc-700 hover:border-sky-200/70 hover:bg-white/90 hover:text-zinc-900"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cx(
          "inline-flex h-8 w-8 items-center justify-center rounded-xl transition",
          active
            ? "bg-white/20 text-white"
            : "bg-sky-100/70 text-sky-700 group-hover:bg-sky-100"
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

