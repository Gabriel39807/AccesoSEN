type DomainScope = "GLOBAL" | "SEDE" | "ROLE" | "ROLE_SEDE";

type DomainRuleRow = {
  id: number;
  domain: string;
  scope: DomainScope;
  role: string | null;
  role_name?: string | null;
  sede: string | null;
  sede_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type RoleRow = {
  id: number;
  code: string;
  name: string;
};

type SedeRow = {
  id: number;
  code: string;
  name: string;
};

type DominiosManagerProps = {
  busy: boolean;
  domains: DomainRuleRow[];
  roles: RoleRow[];
  sedes: SedeRow[];
  domainFilter: string;
  domainRoleFilter: string;
  domainSedeFilter: string;
  domainStatusFilter: "" | "true" | "false";
  domainScopeFilter: "" | DomainScope;
  domainFormId: number | null;
  domainFormValue: string;
  domainFormScope: DomainScope;
  domainFormRole: string;
  domainFormSede: string;
  domainFormActive: boolean;
  fieldError: (field: string) => string | null;
  formatDate: (value?: string | null) => string;
  setDomainFilter: (value: string) => void;
  setDomainRoleFilter: (value: string) => void;
  setDomainSedeFilter: (value: string) => void;
  setDomainStatusFilter: (value: "" | "true" | "false") => void;
  setDomainScopeFilter: (value: "" | DomainScope) => void;
  setDomainFormValue: (value: string) => void;
  setDomainFormRole: (value: string) => void;
  setDomainFormSede: (value: string) => void;
  setDomainFormActive: (value: boolean) => void;
  applyDomainScopeDefaults: (scope: DomainScope) => void;
  resetDomainForm: () => void;
  submitDomainRule: () => void;
  openEditDomain: (row: DomainRuleRow) => void;
  toggleDomainRule: (row: DomainRuleRow) => void;
  deleteDomainRule: (row: DomainRuleRow) => void;
  closeDomainModal: () => void;
};

export default function DominiosManager({
  busy,
  domains,
  roles,
  sedes,
  domainFilter,
  domainRoleFilter,
  domainSedeFilter,
  domainStatusFilter,
  domainScopeFilter,
  domainFormId,
  domainFormValue,
  domainFormScope,
  domainFormRole,
  domainFormSede,
  domainFormActive,
  fieldError,
  formatDate,
  setDomainFilter,
  setDomainRoleFilter,
  setDomainSedeFilter,
  setDomainStatusFilter,
  setDomainScopeFilter,
  setDomainFormValue,
  setDomainFormRole,
  setDomainFormSede,
  setDomainFormActive,
  applyDomainScopeDefaults,
  resetDomainForm,
  submitDomainRule,
  openEditDomain,
  toggleDomainRule,
  deleteDomainRule,
  closeDomainModal,
}: DominiosManagerProps) {
  return (
    <div className="flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid gap-4 xl:grid-cols-[360px,minmax(0,1fr)]">
        <div className="rounded-2xl border border-surface-border bg-surface-muted/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">{domainFormId ? `Editar regla #${domainFormId}` : "Nueva regla de dominio"}</h3>
              <p className="mt-1 text-sm text-text/70">
                Ajusta alcance, rol y sede desde una sola pieza para evitar combinaciones inconsistentes.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {domainFormId ? "Edición" : "Alta"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-text/70">Dominio</label>
              <input
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="empresa.com"
                value={domainFormValue}
                onChange={(event) => setDomainFormValue(event.target.value)}
              />
              {fieldError("domain") ? <p className="text-xs text-rose-600">{fieldError("domain")}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-text/70">Alcance</label>
                <select
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  value={domainFormScope}
                  onChange={(event) => applyDomainScopeDefaults(event.target.value as DomainScope)}
                >
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="SEDE">SEDE</option>
                  <option value="ROLE">ROLE</option>
                  <option value="ROLE_SEDE">ROLE_SEDE</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={domainFormActive}
                  onChange={(event) => setDomainFormActive(event.target.checked)}
                />
                Regla activa
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text/70">Rol</label>
              <select
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={domainFormRole}
                onChange={(event) => setDomainFormRole(event.target.value)}
                disabled={domainFormScope === "GLOBAL" || domainFormScope === "SEDE"}
              >
                <option value="">Sin rol</option>
                {roles.map((row) => (
                  <option key={row.id} value={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text/70">Sede</label>
              <select
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={domainFormSede}
                onChange={(event) => setDomainFormSede(event.target.value)}
                disabled={domainFormScope === "GLOBAL" || domainFormScope === "ROLE"}
              >
                <option value="">Sin sede</option>
                {sedes.map((row) => (
                  <option key={row.id} value={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-surface-border bg-surface px-3 py-3 text-sm text-text/75">
              El alcance controla si la regla aplica globalmente o solo en contextos específicos de RBAC.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {domainFormId ? (
              <button
                type="button"
                onClick={resetDomainForm}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10"
              >
                Cancelar edición
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeDomainModal}
              disabled={busy}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm hover:bg-primary/10 disabled:opacity-60"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={submitDomainRule}
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Guardando..." : domainFormId ? "Guardar regla" : "Crear regla"}
            </button>
          </div>
        </div>

        <div className="min-h-0 rounded-2xl border border-surface-border">
          <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text">Reglas existentes</h3>
                <p className="mt-1 text-sm text-text/70">Filtra y revisa combinaciones activas antes de editar.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{domains.length} visibles</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <input
                className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="Buscar dominio"
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value)}
              />
              <select
                className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={domainScopeFilter}
                onChange={(event) => setDomainScopeFilter(event.target.value as "" | DomainScope)}
              >
                <option value="">Todos los alcances</option>
                <option value="GLOBAL">GLOBAL</option>
                <option value="SEDE">SEDE</option>
                <option value="ROLE">ROLE</option>
                <option value="ROLE_SEDE">ROLE_SEDE</option>
              </select>
              <select
                className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={domainRoleFilter}
                onChange={(event) => setDomainRoleFilter(event.target.value)}
              >
                <option value="">Todos los roles</option>
                {roles.map((row) => (
                  <option key={row.id} value={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={domainSedeFilter}
                onChange={(event) => setDomainSedeFilter(event.target.value)}
              >
                <option value="">Todas las sedes</option>
                {sedes.map((row) => (
                  <option key={row.id} value={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                value={domainStatusFilter}
                onChange={(event) => setDomainStatusFilter(event.target.value as "" | "true" | "false")}
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-primary/10 text-primary backdrop-blur">
                <tr className="text-left">
                  <th className="px-3 py-2">Dominio</th>
                  <th className="px-3 py-2">Alcance</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Sede</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Actualizada</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {domains.length === 0 ? (
                  <tr className="border-t border-surface-border">
                    <td className="px-3 py-4 text-text/70" colSpan={7}>
                      No hay reglas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  domains.map((row) => (
                    <tr key={row.id} className="border-t border-surface-border align-top">
                      <td className="px-3 py-2 font-mono text-text">{row.domain}</td>
                      <td className="px-3 py-2">{row.scope}</td>
                      <td className="px-3 py-2">{row.role_name || row.role || "-"}</td>
                      <td className="px-3 py-2">{row.sede_name || row.sede || "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.is_active ? "bg-primary/10 text-primary" : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {row.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{formatDate(row.updated_at || row.created_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDomain(row)}
                            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDomainRule(row)}
                            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
                          >
                            {row.is_active ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDomainRule(row)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
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
