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
    <section className="rounded-[28px] border border-surface-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-4">
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/70">
            Validacion operativa
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Sesion reforzada del panel</h2>
            <p className="mt-1 max-w-2xl text-sm text-text/68">
              Activa esta verificacion cuando vayas a ejecutar cambios sensibles dentro de la seccion seleccionada.
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-right">
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
              active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
            }`}
          >
            {active ? "Sesion activa" : "Sesion cerrada"}
          </span>
          <p className="text-xs text-text/60">
            {active ? `Vigente hasta ${expiresAtLabel || "-"}` : "Se requiere verificacion para operar el panel."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-[24px] border border-surface-border bg-surface-muted/30 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/55">1. Abrir y validar</p>
              <p className="mt-1 text-sm text-text/70">
                Inicia la sesion con codigo o passkey, luego completa la verificacion del panel.
              </p>
            </div>
            {active ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {sessionId ? `ID ${sessionId.slice(0, 8)}...` : "Panel habilitado"}
              </span>
            ) : null}
          </div>

          {!active ? (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={onRequestOtp}
                  disabled={busy}
                  className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Enviando..." : otpRequestId ? "Reenviar codigo" : "Enviar codigo"}
                </button>
                <button
                  type="button"
                  onClick={onOpenPasskey}
                  disabled={busy || !passkeySupported}
                  className="rounded-2xl border border-primary px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  Abrir con passkey
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end">
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-text/55">2. Ingresa el codigo</span>
                  <input
                    className="w-full rounded-2xl border border-surface-border bg-surface px-3 py-3 text-sm"
                    placeholder="Codigo de verificacion del panel"
                    value={otpCode}
                    onChange={(event) => onOtpCodeChange(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={onVerifyOtp}
                  disabled={busy || !otpRequestId}
                  className="rounded-2xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  3. Verificar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                La sesion reforzada ya esta habilitada para este panel.
              </div>
              <button
                type="button"
                onClick={onCloseSession}
                disabled={busy}
                className="rounded-2xl border border-surface-border px-4 py-3 text-sm font-semibold hover:bg-primary/10 disabled:opacity-60"
              >
                Cerrar sesion reforzada
              </button>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-surface-border bg-surface-muted/20 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/55">4. Motivo obligatorio</p>
            <h3 className="text-sm font-semibold text-text">Motivo del cambio</h3>
            <p className="text-sm text-text/70">
              Este contexto acompana la validacion y queda registrado en auditoria junto con cada mutacion.
            </p>
          </div>
          <textarea
            className="mt-4 min-h-32 w-full rounded-2xl border border-surface-border bg-surface-muted/30 px-3 py-3 text-sm"
            placeholder="Ej: Activar identidad visual del cliente para campus norte"
            value={actionReason}
            onChange={(event) => onActionReasonChange(event.target.value)}
          />
          <p className="mt-3 text-xs text-text/55">
            Debe explicar brevemente el cambio operativo, el alcance y el contexto de negocio.
          </p>
        </div>
      </div>
    </section>
  );
}
