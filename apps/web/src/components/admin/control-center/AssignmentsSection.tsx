type AssignmentRow = {
  id: number;
  role: string;
  role_name?: string;
  permission: string;
  permission_name?: string;
  scope: "GLOBAL" | "SEDE" | "OWN";
};

type RoleRow = {
  id: number;
  code: string;
  name: string;
};

type PermissionRow = {
  id: number;
  code: string;
  name: string;
};

type AssignmentsSectionProps = {
  busy: boolean;
  assignments: AssignmentRow[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  assignmentRole: string;
  assignmentPermission: string;
  assignmentScope: AssignmentRow["scope"];
  setAssignmentRole: (value: string) => void;
  setAssignmentPermission: (value: string) => void;
  setAssignmentScope: (value: AssignmentRow["scope"]) => void;
  submitCreateAssignment: () => void;
  removeAssignment: (row: AssignmentRow) => void;
};

export default function AssignmentsSection({
  busy,
  assignments,
  roles,
  permissions,
  assignmentRole,
  assignmentPermission,
  assignmentScope,
  setAssignmentRole,
  setAssignmentPermission,
  setAssignmentScope,
  submitCreateAssignment,
  removeAssignment,
}: AssignmentsSectionProps) {
  const globalAssignments = assignments.filter((row) => row.scope === "GLOBAL").length;
  const sedeAssignments = assignments.filter((row) => row.scope === "SEDE").length;
  const ownAssignments = assignments.filter((row) => row.scope === "OWN").length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="max-w-2xl space-y-2">
          <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">RBAC activo</span>
          <div>
            <h3 className="text-lg font-semibold text-text">Define asignaciones con mejor contexto</h3>
            <p className="mt-1 text-sm text-text/75">
              Elegimos rol, permiso y alcance en un solo bloque para reducir errores al extender capacidades del sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Global</div>
          <div className="mt-2 text-3xl font-semibold text-text">{globalAssignments}</div>
          <p className="mt-1 text-sm text-text/70">Acceso compartido en todo el sistema.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Por sede</div>
          <div className="mt-2 text-3xl font-semibold text-text">{sedeAssignments}</div>
          <p className="mt-1 text-sm text-text/70">Permisos sujetos al contexto institucional.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Propios</div>
          <div className="mt-2 text-3xl font-semibold text-text">{ownAssignments}</div>
          <p className="mt-1 text-sm text-text/70">Operaciones limitadas al propio recurso.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            value={assignmentRole}
            onChange={(event) => setAssignmentRole(event.target.value)}
          >
            <option value="">Selecciona rol</option>
            {roles.map((row) => (
              <option key={row.id} value={row.code}>
                {row.name} ({row.code})
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            value={assignmentPermission}
            onChange={(event) => setAssignmentPermission(event.target.value)}
          >
            <option value="">Selecciona permiso</option>
            {permissions.map((row) => (
              <option key={row.id} value={row.code}>
                {row.name} ({row.code})
              </option>
            ))}
          </select>

          <select
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            value={assignmentScope}
            onChange={(event) => setAssignmentScope(event.target.value as AssignmentRow["scope"])}
          >
            <option value="GLOBAL">GLOBAL</option>
            <option value="SEDE">SEDE</option>
            <option value="OWN">OWN</option>
          </select>
        </div>

        <div className="mt-3 flex justify-between gap-3">
          <p className="max-w-2xl text-sm text-text/70">Crea relaciones RBAC sin salir del panel, manteniendo visible el listado actual.</p>
          <button
            type="button"
            onClick={submitCreateAssignment}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Guardando..." : "Asignar permiso"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Permiso</th>
              <th className="px-3 py-2">Alcance</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={4}>
                  No hay asignaciones registradas todavía.
                </td>
              </tr>
            ) : (
              assignments.map((row) => (
                <tr key={row.id} className="border-t border-surface-border">
                  <td className="px-3 py-2">{row.role_name || row.role}</td>
                  <td className="px-3 py-2">{row.permission_name || row.permission}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{row.scope}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeAssignment(row)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
