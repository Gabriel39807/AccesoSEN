import AdminShell from "@/components/admin/AdminShell";

/**
 * Layout de Administrador (desktop).
 * Mantiene el navbar superior y un contenedor amplio.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
