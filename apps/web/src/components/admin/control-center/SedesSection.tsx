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
};

export default function SedesSection({
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
}: SedesSectionProps) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
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
          <label className="text-xs text-text/70">Nombre de sede</label>
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
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submitCreateSede}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Guardando..." : "Crear sede"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border">
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
            {sedes.map((row) => (
              <tr key={row.id} className="border-t border-surface-border">
                <td className="px-3 py-2">{row.name}</td>
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
                  <div className="inline-flex gap-2">
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
            ))}
          </tbody>
        </table>
      </div>

      {editingSedeId ? (
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">Editar sede #{editingSedeId}</h3>
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
              Cancelar
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
    </>
  );
}
