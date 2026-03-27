type ProgramRow = {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  active_users_count?: number;
  can_delete?: boolean;
};

type ProgramasManagerProps = {
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
  closeProgramModal: () => void;
  openEditProgram: (row: ProgramRow) => void;
  submitProgram: () => void;
  toggleProgram: (row: ProgramRow) => void;
  deleteProgram: (row: ProgramRow) => void;
};

export default function ProgramasManager({
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
  closeProgramModal,
  openEditProgram,
  submitProgram,
  toggleProgram,
  deleteProgram,
}: ProgramasManagerProps) {
  return (
    <div className="flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr)]">
        <div className="rounded-2xl border border-surface-border bg-surface-muted/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">{programFormId ? `Editar programa #${programFormId}` : "Nuevo programa"}</h3>
              <p className="mt-1 text-sm text-text/70">
                Crea el catálogo aceptado o ajusta un nombre existente sin salir del centro de control.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {programFormId ? "Edición" : "Alta"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
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

            <label className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-text">
              <input
                type="checkbox"
                checked={programFormActive}
                onChange={(event) => setProgramFormActive(event.target.checked)}
              />
              Programa activo
            </label>

            <div className="rounded-2xl border border-surface-border bg-surface px-3 py-3 text-sm text-text/75">
              Los programas inactivos permanecen para histórico, pero dejan de aparecer en formularios e importaciones nuevas.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {programFormId ? (
              <button
                type="button"
                onClick={resetProgramForm}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10"
              >
                Cancelar edición
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeProgramModal}
              disabled={busy}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10 disabled:opacity-60"
            >
              Cerrar
            </button>
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

        <div className="min-h-0 rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Programas existentes</h3>
              <p className="mt-1 text-sm text-text/70">Edita, activa o desactiva el catálogo actual desde aquí.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{programas.length} programas</span>
          </div>

          <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-primary/10 text-primary backdrop-blur">
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
                    <tr key={row.id} className="border-t border-surface-border align-top">
                      <td className="px-3 py-2 font-medium text-text">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.is_active ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-700"}`}>
                          {row.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.active_users_count ?? 0}</td>
                      <td className="px-3 py-2">{formatDate(row.updated_at || row.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
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
      </div>
    </div>
  );
}
