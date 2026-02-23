export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-200/90 bg-gradient-to-br from-sky-50/80 to-cyan-50/60 p-5 text-sm text-zinc-600">
      {icon ? <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-sky-700">{icon}</div> : null}
      <div className="font-semibold text-zinc-900">{title}</div>
      <p className="mt-1">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

