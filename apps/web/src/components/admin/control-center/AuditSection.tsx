type AuditRow = {
  id: string;
  type: string;
  timestamp: string | null;
  actor: string | null;
  detail: string;
  sede: string | null;
};

type AuditSectionProps = {
  busy: boolean;
  auditRows: AuditRow[];
  sedesByCode: Map<string, string>;
  formatDate: (value?: string | null) => string;
  reloadAudit: () => void;
};

export default function AuditSection({ busy, auditRows, sedesByCode, formatDate, reloadAudit }: AuditSectionProps) {
  const actorCount = new Set(auditRows.map((row) => row.actor).filter(Boolean)).size;
  const sedeCount = new Set(auditRows.map((row) => row.sede).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(31,89,214,0.08),rgba(255,255,255,0.92))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">Trazabilidad</span>
            <div>
              <h3 className="text-lg font-semibold text-text">Auditoría reciente del centro de control</h3>
              <p className="mt-1 text-sm text-text/75">
                Revisa los eventos recientes sin perder contexto de actor, sede y detalle de operación.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reloadAudit}
            disabled={busy}
            className="rounded-2xl border border-surface-border bg-white/80 px-4 py-2.5 text-sm font-semibold text-text shadow-sm transition hover:bg-primary/10 hover:text-primary disabled:opacity-60"
          >
            Recargar auditoría
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Eventos</div>
          <div className="mt-2 text-3xl font-semibold text-text">{auditRows.length}</div>
          <p className="mt-1 text-sm text-text/70">Filas visibles en la carga actual.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Actores</div>
          <div className="mt-2 text-3xl font-semibold text-text">{actorCount}</div>
          <p className="mt-1 text-sm text-text/70">Usuarios distintos detectados en la muestra.</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text/60">Sedes</div>
          <div className="mt-2 text-3xl font-semibold text-text">{sedeCount}</div>
          <p className="mt-1 text-sm text-text/70">Contextos institucionales con actividad reciente.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr className="text-left">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Sede</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.length === 0 ? (
              <tr className="border-t border-surface-border">
                <td className="px-3 py-4 text-text/70" colSpan={5}>
                  No hay eventos recientes.
                </td>
              </tr>
            ) : (
              auditRows.map((row) => (
                <tr key={row.id} className="border-t border-surface-border align-top">
                  <td className="px-3 py-2">{formatDate(row.timestamp)}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">{row.actor || "-"}</td>
                  <td className="px-3 py-2">{row.sede ? sedesByCode.get(row.sede) || row.sede : "-"}</td>
                  <td className="px-3 py-2">{row.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
