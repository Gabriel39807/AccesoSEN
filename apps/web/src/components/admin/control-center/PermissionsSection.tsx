type PermissionRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
};

type PermissionsSectionProps = {
  busy: boolean;
  permissions: PermissionRow[];
  permissionCode: string;
  permissionName: string;
  permissionDescription: string;
  formatDate: (value?: string | null) => string;
  setPermissionCode: (value: string) => void;
  setPermissionName: (value: string) => void;
  setPermissionDescription: (value: string) => void;
  submitCreatePermission: () => void;
};

export default function PermissionsSection({
  busy,
  permissions,
  permissionCode,
  permissionName,
  permissionDescription,
  formatDate,
  setPermissionCode,
  setPermissionName,
  setPermissionDescription,
  submitCreatePermission,
}: PermissionsSectionProps) {
  const describedPermissions = permissions.filter((row) => Boolean(row.description?.trim())).length;
  const recentPermissions = [...permissions]
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="max-w-2xl space-y-2">
          <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">Capacidades</span>
          <div>
            <h3 className="text-lg font-semibold text-text">Organiza permisos con más contexto</h3>
            <p className="mt-1 text-sm text-text/75">
              Dejamos el alta visible, pero reforzamos lectura y cobertura descriptiva para que el catálogo sea más fácil de mantener.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Totales</div>
          <div className="mt-2 text-3xl font-semibold text-text">{permissions.length}</div>
          <p className="mt-1 text-sm text-text/70">Permisos cargados en la sesión actual.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Con descripción</div>
          <div className="mt-2 text-3xl font-semibold text-text">{describedPermissions}</div>
          <p className="mt-1 text-sm text-text/70">Listos para auditoría y mantenimiento.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Sin descripción</div>
          <div className="mt-2 text-3xl font-semibold text-text">{permissions.length - describedPermissions}</div>
          <p className="mt-1 text-sm text-text/70">Candidatos a documentación funcional más clara.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <input
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="código del permiso"
            value={permissionCode}
            onChange={(event) => setPermissionCode(event.target.value)}
          />
          <input
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="nombre del permiso"
            value={permissionName}
            onChange={(event) => setPermissionName(event.target.value)}
          />
        </div>
        <textarea
          className="mt-3 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder="descripción (opcional)"
          value={permissionDescription}
          onChange={(event) => setPermissionDescription(event.target.value)}
        />
        <div className="mt-3 flex justify-between gap-3">
          <p className="max-w-2xl text-sm text-text/70">Describe el permiso cuando la intención no sea obvia desde el código.</p>
          <button
            type="button"
            onClick={submitCreatePermission}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Guardando..." : "Crear permiso"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {recentPermissions.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={4}>
                  No hay permisos configurados todavía.
                </td>
              </tr>
            ) : (
              recentPermissions.map((row) => (
                <tr key={row.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-mono">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.description || "-"}</td>
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
