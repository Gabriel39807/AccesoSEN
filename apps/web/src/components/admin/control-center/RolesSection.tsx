type RoleRow = {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
  created_at?: string | null;
};

type RolesSectionProps = {
  busy: boolean;
  roles: RoleRow[];
  roleCode: string;
  roleName: string;
  formatDate: (value?: string | null) => string;
  setRoleCode: (value: string) => void;
  setRoleName: (value: string) => void;
  submitCreateRole: () => void;
};

export default function RolesSection({
  busy,
  roles,
  roleCode,
  roleName,
  formatDate,
  setRoleCode,
  setRoleName,
  submitCreateRole,
}: RolesSectionProps) {
  const systemRoles = roles.filter((row) => row.is_system).length;
  const customRoles = roles.length - systemRoles;
  const recentRoles = [...roles]
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="max-w-2xl space-y-2">
          <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">Base RBAC</span>
          <div>
            <h3 className="text-lg font-semibold text-text">Extiende roles con un flujo más claro</h3>
            <p className="mt-1 text-sm text-text/75">
              Separa los roles del sistema de los personalizados y deja el alta visible al lado del catálogo actual.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Totales</div>
          <div className="mt-2 text-3xl font-semibold text-text">{roles.length}</div>
          <p className="mt-1 text-sm text-text/70">Roles cargados en la sesión reforzada.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Sistema</div>
          <div className="mt-2 text-3xl font-semibold text-text">{systemRoles}</div>
          <p className="mt-1 text-sm text-text/70">Se preservan como base del producto.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Personalizados</div>
          <div className="mt-2 text-3xl font-semibold text-text">{customRoles}</div>
          <p className="mt-1 text-sm text-text/70">Extensiones creadas desde el centro de control.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <input
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="código del rol"
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value)}
          />
          <input
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="nombre del rol"
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-between gap-3">
          <p className="max-w-2xl text-sm text-text/70">Usa códigos estables para mantener coherencia con asignaciones y filtros posteriores.</p>
          <button
            type="button"
            onClick={submitCreateRole}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Guardando..." : "Crear rol"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Sistema</th>
              <th className="px-3 py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {recentRoles.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={4}>
                  No hay roles configurados todavía.
                </td>
              </tr>
            ) : (
              recentRoles.map((row) => (
                <tr key={row.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-mono">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.is_system ? "Si" : "No"}</td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
