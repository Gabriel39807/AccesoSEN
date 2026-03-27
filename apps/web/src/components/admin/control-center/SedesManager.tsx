type SedeRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string | null;
};

type SedesManagerProps = {
  busy: boolean;
  sedes: SedeRow[];
  createSedeCode: string;
  createSedeName: string;
  editingSedeId: number | null;
  editingSedeCode: string;
  editingSedeName: string;
  editingSedeActive: boolean;
  fieldError: (field: string) => string | null;
  formatDate: (value?: string | null) => string;
  setCreateSedeCode: (value: string) => void;
  setCreateSedeName: (value: string) => void;
  setEditingSedeId: (value: number | null) => void;
  setEditingSedeCode: (value: string) => void;
  setEditingSedeName: (value: string) => void;
  setEditingSedeActive: (value: boolean) => void;
  clearFieldErrors: (field: "code" | "name") => void;
  submitCreateSede: () => void;
  submitEditSede: () => void;
  openEditSede: (row: SedeRow) => void;
  deactivateSede: (row: SedeRow) => void;
  closeSedeModal: () => void;
};

export default function SedesManager({
  busy,
  sedes,
  createSedeCode,
  createSedeName,
  editingSedeId,
  editingSedeCode,
  editingSedeName,
  editingSedeActive,
  fieldError,
  formatDate,
  setCreateSedeCode,
  setCreateSedeName,
  setEditingSedeId,
  setEditingSedeCode,
  setEditingSedeName,
  setEditingSedeActive,
  clearFieldErrors,
  submitCreateSede,
  submitEditSede,
  openEditSede,
  deactivateSede,
  closeSedeModal,
}: SedesManagerProps) {
  return (
    <div className="flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr)]">
        <div className="rounded-2xl border border-surface-border bg-surface-muted/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Nueva sede</h3>
              <p className="mt-1 text-sm text-text/70">
                Crea sedes nuevas o abre una fila existente para editarla sin salir del flujo reforzado.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Catálogo vivo</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-text/70">Código de sede</label>
              <input
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={createSedeCode}
                onChange={(event) => {
                  setCreateSedeCode(event.target.value);
                  clearFieldErrors("code");
                }}
                placeholder="sede-norte"
              />
              {fieldError("code") ? <p className="text-xs text-rose-600">{fieldError("code")}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text/70">Nombre visible</label>
              <input
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={createSedeName}
                onChange={(event) => {
                  setCreateSedeName(event.target.value);
                  clearFieldErrors("name");
                }}
                placeholder="Sede Norte"
              />
              {fieldError("name") ? <p className="text-xs text-rose-600">{fieldError("name")}</p> : null}
            </div>

            <div className="rounded-2xl border border-surface-border bg-surface px-3 py-3 text-sm text-text/75">
              Desactivar una sede la conserva para histórico y sincroniza los selectores que consumen el catálogo.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closeSedeModal}
              disabled={busy}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10 disabled:opacity-60"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={submitCreateSede}
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Guardando..." : "Crear sede"}
            </button>
          </div>
        </div>

        <div className="min-h-0 rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Sedes existentes</h3>
              <p className="mt-1 text-sm text-text/70">Edita nombre, código y estado desde la misma vista.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{sedes.length} sedes</span>
          </div>

          <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-primary/10 text-primary backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Creada</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sedes.length === 0 ? (
                  <tr className="border-t border-surface-border">
                    <td className="px-3 py-4 text-text/70" colSpan={5}>
                      No hay sedes registradas todavía.
                    </td>
                  </tr>
                ) : (
                  sedes.map((row) => (
                    <tr key={row.id} className="border-t border-surface-border align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-text">{row.name}</div>
                        {editingSedeId === row.id ? <p className="mt-1 text-xs text-primary">Editando ahora</p> : null}
                      </td>
                      <td className="px-3 py-2 font-mono">{row.code}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.is_active ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {row.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditSede(row)}
                            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateSede(row)}
                            disabled={!row.is_active || busy}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Desactivar
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

      {editingSedeId ? (
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Editar sede #{editingSedeId}</h3>
              <p className="mt-1 text-sm text-text/70">Ajusta código, nombre o estado y guarda con motivo de auditoría.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Edición</span>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <input
              className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              value={editingSedeCode}
              onChange={(event) => setEditingSedeCode(event.target.value)}
              placeholder="código"
            />
            <input
              className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              value={editingSedeName}
              onChange={(event) => setEditingSedeName(event.target.value)}
              placeholder="nombre"
            />
            <select
              className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              value={editingSedeActive ? "true" : "false"}
              onChange={(event) => setEditingSedeActive(event.target.value === "true")}
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingSedeId(null)}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10"
            >
              Cancelar edición
            </button>
            <button
              type="button"
              onClick={submitEditSede}
              disabled={busy}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
