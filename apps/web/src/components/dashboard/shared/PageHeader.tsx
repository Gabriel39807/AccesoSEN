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
      className={`sadi-card rounded-3xl p-4 sm:p-5 ${
        sticky ? "sticky top-3 z-20 sm:top-4" : ""
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="sadi-kicker text-xs font-semibold">{breadcrumb}</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm sadi-text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-stretch gap-2 sm:items-center sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}
