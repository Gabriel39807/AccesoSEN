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

type DominiosSectionProps = {
  busy: boolean;
  domains: DomainRuleRow[];
  formatDate: (value?: string | null) => string;
  openDomainModal: () => void;
  openEditDomain: (row: DomainRuleRow) => void;
};

export default function DominiosSection({ busy, domains, formatDate, openDomainModal, openEditDomain }: DominiosSectionProps) {
  const activeRules = domains.filter((row) => row.is_active);
  const scopedRules = domains.filter((row) => row.scope !== "GLOBAL");
  const recentRules = [...domains]
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              Reglas de acceso
            </span>
            <div>
              <h3 className="text-lg font-semibold text-text">Gestiona dominios desde un solo gestor</h3>
              <p className="mt-1 text-sm text-text/75">
                Centralizamos filtros, creación y edición para revisar el impacto por alcance antes de tocar reglas activas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openDomainModal}
            disabled={busy}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            Abrir gestor de dominios
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Activas</div>
          <div className="mt-2 text-3xl font-semibold text-text">{activeRules.length}</div>
          <p className="mt-1 text-sm text-text/70">Se aplican en validaciones actuales del producto.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Alcance específico</div>
          <div className="mt-2 text-3xl font-semibold text-text">{scopedRules.length}</div>
          <p className="mt-1 text-sm text-text/70">Reglas atadas a sede, rol o combinaciones.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Totales</div>
          <div className="mt-2 text-3xl font-semibold text-text">{domains.length}</div>
          <p className="mt-1 text-sm text-text/70">Incluye activas e inactivas para revisión histórica.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Las reglas activas de dominio afectan el registro y la validación de usuarios en todo el sistema.
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Reglas recientes</h3>
            <p className="mt-1 text-sm text-text/70">Vista rápida antes de abrir el gestor completo.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{domains.length} reglas</span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-surface-border">
          <table className="min-w-full text-sm">
            <thead className="bg-primary/10 text-primary">
              <tr className="text-left">
                <th className="px-3 py-2">Dominio</th>
                <th className="px-3 py-2">Alcance</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Actualizada</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {recentRules.length === 0 ? (
                <tr className="border-t border-surface-border">
                  <td className="px-3 py-4 text-text/70" colSpan={5}>
                    No hay reglas configuradas todavía.
                  </td>
                </tr>
              ) : (
                recentRules.map((row) => (
                  <tr key={row.id} className="border-t border-surface-border">
                    <td className="px-3 py-2 font-mono text-text">{row.domain}</td>
                    <td className="px-3 py-2">{row.scope}</td>
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
                      <button
                        type="button"
                        onClick={() => openEditDomain(row)}
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
    </div>
  );
}
