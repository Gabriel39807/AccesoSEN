import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-200/90 bg-gradient-to-br from-sky-50/80 to-cyan-50/60 p-5 text-sm text-zinc-600">
      <div className="font-semibold text-zinc-900">{title}</div>
      <p className="mt-1">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

