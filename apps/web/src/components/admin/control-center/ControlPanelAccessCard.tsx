type ControlPanelAccessCardProps = {
  active: boolean;
  busy: boolean;
  passkeySupported: boolean;
  sessionId?: string | null;
  expiresAtLabel?: string | null;
  actionReason: string;
  onActionReasonChange: (value: string) => void;
  onOpenPasskey: () => void;
  onCloseSession: () => void;
};

export default function ControlPanelAccessCard({
  active,
  busy,
  passkeySupported,
  sessionId,
  expiresAtLabel,
  actionReason,
  onActionReasonChange,
  onOpenPasskey,
  onCloseSession,
}: ControlPanelAccessCardProps) {
  const reasonHelper = active
    ? "Se envía en cada mutación del panel y queda registrado en auditoría."
    : "Se habilita cuando abras la sesión reforzada con passkey. Así evitamos pasos muertos en la demo.";

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
      <div className="sadi-card rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Sesión reforzada del panel</h2>
            <p className="sadi-text-soft text-xs">
              {active
                ? `Activa hasta ${expiresAtLabel || "-"}`
                : "Abre una sesión reforzada para operar identidad visual, permisos, dominios y auditoría."}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
            {active ? "Activa" : "Cerrada"}
          </span>
        </div>

        {!active ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenPasskey}
                disabled={busy || !passkeySupported}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Abriendo..." : "Abrir con passkey"}
              </button>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                OTP del panel deshabilitado
              </span>
            </div>
            <p className="rounded-2xl border border-surface-border bg-surface-muted/70 px-3 py-3 text-sm text-text/75">
              Para la presentacion dejamos disponible solo el acceso con passkey en este panel. Asi evitamos que los usuarios entren en un flujo OTP inestable en produccion.
              {!passkeySupported ? " Usa un navegador compatible con WebAuthn para abrir la sesion reforzada." : ""}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              Sesión: {sessionId?.slice(0, 8)}...
            </div>
            <button
              type="button"
              onClick={onCloseSession}
              disabled={busy}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm font-semibold hover:bg-primary/10 disabled:opacity-60"
            >
              Cerrar sesión reforzada
            </button>
          </div>
        )}
      </div>

      <div className="sadi-card rounded-3xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-text">Motivo del cambio</h2>
        <p className="sadi-text-soft mt-1 text-xs">
          {reasonHelper}
        </p>
        <textarea
          className="mt-3 min-h-24 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text/60"
          placeholder="Ej: Activar identidad visual del cliente para campus norte"
          value={actionReason}
          onChange={(event) => onActionReasonChange(event.target.value)}
          disabled={!active}
        />
      </div>
    </div>
  );
}
