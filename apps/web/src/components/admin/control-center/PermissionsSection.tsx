type PermissionRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
};

type PermissionsSectionProps = {
  busy: boolean;
  permissions: PermissionRow[];
  permissionCode: string;
  permissionName: string;
  permissionDescription: string;
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
  setPermissionCode,
  setPermissionName,
  setPermissionDescription,
  submitCreatePermission,
}: PermissionsSectionProps) {
  return (
    <>
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
        className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
        placeholder="descripción (opcional)"
        value={permissionDescription}
        onChange={(event) => setPermissionDescription(event.target.value)}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submitCreatePermission}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Guardando..." : "Crear permiso"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((row) => (
              <tr key={row.id} className="border-t border-surface-border">
                <td className="px-3 py-2 font-mono">{row.code}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.description || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
