export default function FilterBar({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="sadi-card rounded-[1.3rem] p-3 sm:p-3.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12 md:items-end">{children}</div>
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </section>
  );
}
