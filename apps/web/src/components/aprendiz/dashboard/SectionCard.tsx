export default function SectionCard({
  title,
  subtitle,
  action,
  className,
  contentClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_8px_30px_rgba(3,7,18,0.05)] backdrop-blur-sm ${
        className ?? ""
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-zinc-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

