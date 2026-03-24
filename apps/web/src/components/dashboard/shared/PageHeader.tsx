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
      className={`sadi-card-strong min-w-0 overflow-hidden rounded-[1.35rem] border px-3.5 py-3.5 sm:px-4 sm:py-4${sticky ? " sticky top-2 z-20 backdrop-blur-md sm:top-3" : ""}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="sadi-kicker text-[11px] font-semibold">{breadcrumb}</p>
          <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-0.03em] text-[color:var(--foreground)] sm:text-[1.9rem] sm:leading-[1.04]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-snug text-[color:var(--text-muted)] sm:text-[0.9rem]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

