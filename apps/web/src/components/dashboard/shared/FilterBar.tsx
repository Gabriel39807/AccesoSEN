export default function FilterBar({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_10px_28px_rgba(2,6,23,0.06)] backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}

