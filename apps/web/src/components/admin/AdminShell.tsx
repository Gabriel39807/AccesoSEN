import AdminTopNav from "./AdminTopNav";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-emerald-50/70 via-cyan-50/30 to-zinc-100/70">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
      </div>
      <AdminTopNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
