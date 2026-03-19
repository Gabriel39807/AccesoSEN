type ControlPanelAccessCardProps = {
  active: boolean;
  busy: boolean;
  passkeySupported: boolean;
  otpRequestId: string;
  otpCode: string;
  sessionId?: string | null;
  expiresAtLabel?: string | null;
  actionReason: string;
  onOtpCodeChange: (value: string) => void;
  onActionReasonChange: (value: string) => void;
  onRequestOtp: () => void;
  onOpenPasskey: () => void;
  onVerifyOtp: () => void;
  onCloseSession: () => void;
};

export default function ControlPanelAccessCard({
  active,
  busy,
  passkeySupported,
  otpRequestId,
  otpCode,
  sessionId,
  expiresAtLabel,
  actionReason,
  onOtpCodeChange,
  onActionReasonChange,
  onRequestOtp,
  onOpenPasskey,
  onVerifyOtp,
  onCloseSession,
}: ControlPanelAccessCardProps) {
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
          <div className="mt-4 grid gap-3 lg:grid-cols-[auto,minmax(0,1fr),auto] lg:items-center">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRequestOtp}
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Enviando..." : otpRequestId ? "Reenviar código" : "Enviar código"}
              </button>
              <button
                type="button"
                onClick={onOpenPasskey}
                disabled={busy || !passkeySupported}
                className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
              >
                Abrir con passkey
              </button>
            </div>
            <input
              className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              placeholder="Código de verificación del panel"
              value={otpCode}
              onChange={(event) => onOtpCodeChange(event.target.value)}
            />
            <button
              type="button"
              onClick={onVerifyOtp}
              disabled={busy || !otpRequestId}
              className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              Verificar
            </button>
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
          Se envía en cada mutación del panel y queda registrado en auditoría.
        </p>
        <textarea
          className="mt-3 min-h-24 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder="Ej: Activar identidad visual del cliente para campus norte"
          value={actionReason}
          onChange={(event) => onActionReasonChange(event.target.value)}
        />
      </div>
    </div>
  );
}
