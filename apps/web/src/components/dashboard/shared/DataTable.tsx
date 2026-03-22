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
    <section className="sadi-card-strong min-w-0 overflow-hidden rounded-[1.85rem] border">
      <div className="w-full overflow-x-auto">
        <table className={cx("min-w-full text-sm text-[color:var(--text-soft)]", tableClassName)}>
          <thead
            className={cx(
              "bg-[linear-gradient(180deg,rgba(22,33,47,0.98),rgba(14,21,31,0.98))] text-[color:var(--text-soft)]",
              stickyHeader && "sticky top-0 z-10 backdrop-blur-sm",
            )}
          >
            {headers}
          </thead>
          <tbody className="divide-y divide-[color:var(--surface-border)] bg-[rgba(8,14,21,0.72)]">
            {children}
            {!hasRows && emptyState ? emptyState : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
