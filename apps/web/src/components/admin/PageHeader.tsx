export default function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
  sticky = true,
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
        sticky ? "sticky top-[76px] z-20" : ""
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{breadcrumb}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
