/**
 * Layout base (zona autenticada).
 *
 * La validacion de sesion y rol se resuelve en middleware server-side
 * para no exponer shells protegidos antes del redirect.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
