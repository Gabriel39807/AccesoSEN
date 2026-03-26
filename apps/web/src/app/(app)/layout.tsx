import AppProviders from "@/components/providers/app-providers";

/**
 * Layout base (zona autenticada).
 *
 * La validacion de sesion y rol se resuelve en middleware server-side
 * para no exponer shells protegidos antes del redirect.
 */
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="min-h-screen bg-zinc-50 text-zinc-900">{children}</div>
    </AppProviders>
  );
}
