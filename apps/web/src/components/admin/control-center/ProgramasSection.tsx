type ProgramRow = {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  active_users_count?: number;
  can_delete?: boolean;
};

type ProgramasSectionProps = {
  busy: boolean;
  programas: ProgramRow[];
  programFormId: number | null;
  programFormName: string;
  programFormActive: boolean;
  fieldError: (field: string) => string | null;
  formatDate: (value?: string | null) => string;
  setProgramFormName: (value: string) => void;
  setProgramFormActive: (value: boolean) => void;
  resetProgramForm: () => void;
  openEditProgram: (row: ProgramRow) => void;
  submitProgram: () => void;
  toggleProgram: (row: ProgramRow) => void;
  deleteProgram: (row: ProgramRow) => void;
};

export default function ProgramasSection({
  busy,
  programas,
  programFormId,
  programFormName,
  programFormActive,
  fieldError,
  formatDate,
  setProgramFormName,
  setProgramFormActive,
  resetProgramForm,
  openEditProgram,
  submitProgram,
  toggleProgram,
  deleteProgram,
}: ProgramasSectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Los programas activos son la fuente de verdad para crear usuarios e importar aprendices.
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text">{programFormId ? `Editar programa #${programFormId}` : "Nuevo programa"}</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr),180px]">
          <div className="space-y-1">
            <label className="text-xs text-text/70">Nombre visible</label>
            <input
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              value={programFormName}
              onChange={(event) => setProgramFormName(event.target.value)}
              placeholder="Analisis y Desarrollo de Software"
            />
            {fieldError("name") ? <p className="text-xs text-rose-600">{fieldError("name")}</p> : null}
          </div>
          <label className="inline-flex items-center gap-2 self-end rounded-xl border border-surface-border px-3 py-2 text-sm text-text">
            <input
              type="checkbox"
              checked={programFormActive}
              onChange={(event) => setProgramFormActive(event.target.checked)}
            />
            Programa activo
          </label>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          {programFormId ? (
            <button
              type="button"
              onClick={resetProgramForm}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={submitProgram}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Guardando..." : programFormId ? "Guardar programa" : "Crear programa"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Programa</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Usuarios</th>
              <th className="px-3 py-2">Actualizado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {programas.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={5}>
                  No hay programas configurados.
                </td>
              </tr>
            ) : (
              programas.map((row) => (
                <tr key={row.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-medium text-text">{row.name}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Activo</span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">Inactivo</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.active_users_count ?? 0}</td>
                  <td className="px-3 py-2">{formatDate(row.updated_at || row.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditProgram(row)}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProgram(row)}
                        disabled={busy}
                        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10 disabled:opacity-50"
                      >
                        {row.is_active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProgram(row)}
                        disabled={busy || row.can_delete === false}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
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
