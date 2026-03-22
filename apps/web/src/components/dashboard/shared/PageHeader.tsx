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
      className={[
        "sadi-card-strong rounded-[1.9rem] border px-5 py-5 sm:px-6 sm:py-6",
        sticky ? "sticky top-3 z-20 sm:top-4" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="sadi-kicker text-[11px] font-semibold">{breadcrumb}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)] sm:text-[2.45rem] sm:leading-[1.05]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--text-muted)] sm:text-[0.95rem]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-stretch gap-2 sm:items-center sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
