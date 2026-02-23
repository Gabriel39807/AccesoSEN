export default function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
  sticky = false,
}: {
  breadcrumb: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/80 bg-white/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm ${
        sticky ? "sticky top-4 z-20" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{breadcrumb}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

