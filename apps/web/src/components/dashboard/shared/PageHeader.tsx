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
      className={`sadi-card-strong min-w-0 overflow-hidden rounded-[1.45rem] border px-4 py-3.5 sm:px-4.5 sm:py-4${sticky ? " sticky top-2 z-20 backdrop-blur-md sm:top-3" : ""}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-subtle)] px-2.5 py-0.5">
            <p className="sadi-kicker text-[8.5px] font-semibold text-[color:var(--color-text-muted)]">{breadcrumb}</p>
          </div>
          <h1 className="mt-2 text-[1.58rem] font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-[1.98rem] sm:leading-[1.02]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-[0.9rem] leading-relaxed text-[color:var(--text-soft)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:self-center">{actions}</div> : null}
      </div>
    </section>
  );
}
