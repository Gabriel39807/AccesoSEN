type SedeRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string | null;
};

type SedesSectionProps = {
  busy: boolean;
  sedes: SedeRow[];
  formatDate: (value?: string | null) => string;
  openSedeModal: () => void;
  openEditSede: (row: SedeRow) => void;
};

export default function SedesSection({
  busy,
  sedes,
  formatDate,
  openSedeModal,
  openEditSede,
}: SedesSectionProps) {
  const activeSedes = sedes.filter((row) => row.is_active);
  const inactiveSedes = sedes.length - activeSedes.length;
  const recentSedes = [...sedes]
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              Catálogo institucional
            </span>
            <div>
              <h3 className="text-lg font-semibold text-text">Gestiona sedes desde un solo modal</h3>
              <p className="mt-1 text-sm text-text/75">
                Conservamos el panel limpio y movemos la operación completa a un gestor con altas, edición y revisión rápida.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openSedeModal}
            disabled={busy}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            Abrir gestor de sedes
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Activas</div>
          <div className="mt-2 text-3xl font-semibold text-text">{activeSedes.length}</div>
          <p className="mt-1 text-sm text-text/70">Disponibles para operación y asignación actual.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Inactivas</div>
          <div className="mt-2 text-3xl font-semibold text-text">{inactiveSedes}</div>
          <p className="mt-1 text-sm text-text/70">Se mantienen para trazabilidad y consistencia histórica.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Total</div>
          <div className="mt-2 text-3xl font-semibold text-text">{sedes.length}</div>
          <p className="mt-1 text-sm text-text/70">Catálogo visible para el superadmin.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Las sedes alimentan filtros y operaciones administrativas, así que el catálogo debe mantenerse consistente.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Creada</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recentSedes.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={5}>
                  No hay sedes configuradas todavía.
                </td>
              </tr>
            ) : (
              recentSedes.map((row) => (
                <tr key={row.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-medium text-text">{row.name}</td>
                  <td className="px-3 py-2 font-mono">{row.code}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Activa</span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">Inactiva</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEditSede(row)}
                      className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
                    >
                      Editar en modal
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
