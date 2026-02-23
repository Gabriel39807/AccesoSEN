import Link from "next/link";

import SharedEmptyState from "@/components/dashboard/shared/EmptyState";

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
    <SharedEmptyState
      title={title}
      description={description}
      action={
        actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
          >
            {actionLabel}
          </Link>
        ) : null
      }
    />
  );
}
