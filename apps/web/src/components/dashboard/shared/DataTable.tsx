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
    <section className="overflow-auto rounded-3xl border border-white/80 bg-white/80 shadow-[0_10px_28px_rgba(2,6,23,0.06)]">
      <table className={cx("min-w-full text-sm", tableClassName)}>
        <thead
          className={cx(
            "bg-sky-50 text-sky-900",
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
    </section>
  );
}

