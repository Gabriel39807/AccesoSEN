export default function FilterBar({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="sadi-card rounded-3xl p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}
