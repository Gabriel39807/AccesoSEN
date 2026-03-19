function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function DataTable({
  headers,
  children,
  loading,
  skeleton,
  emptyState,
  hasRows,
  tableClassName,
  stickyHeader = true,
}: {
  headers: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  skeleton?: React.ReactNode;
  emptyState?: React.ReactNode;
  hasRows: boolean;
  tableClassName?: string;
  stickyHeader?: boolean;
}) {
  if (loading && skeleton) return <>{skeleton}</>;
  return (
    <section className="sadi-card overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <table className={cx("min-w-full text-sm", tableClassName)}>
        <thead
          className={cx(
            "bg-primary/10 text-primary",
            stickyHeader && "sticky top-0 z-10"
          )}
        >
          {headers}
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {children}
          {!hasRows && emptyState ? emptyState : null}
        </tbody>
        </table>
      </div>
    </section>
  );
}
