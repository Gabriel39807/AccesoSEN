type RoleRow = {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
};

type RolesSectionProps = {
  busy: boolean;
  roles: RoleRow[];
  roleCode: string;
  roleName: string;
  setRoleCode: (value: string) => void;
  setRoleName: (value: string) => void;
  submitCreateRole: () => void;
};

export default function RolesSection({
  busy,
  roles,
  roleCode,
  roleName,
  setRoleCode,
  setRoleName,
  submitCreateRole,
}: RolesSectionProps) {
  return (
    <>
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submitCreateRole}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Guardando..." : "Crear rol"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Sistema</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((row) => (
              <tr key={row.id} className="border-t border-surface-border">
                <td className="px-3 py-2 font-mono">{row.code}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.is_system ? "Si" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
