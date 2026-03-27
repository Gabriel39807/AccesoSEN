type ControlPanelAccessCardProps = {
  active: boolean;
  busy: boolean;
  sessionId?: string | null;
  expiresAtLabel?: string | null;
  actionReason: string;
  reauthPassword: string;
  reauthError?: string | null;
  reauthMode: "real" | "presentation";
  onActionReasonChange: (value: string) => void;
  onReauthPasswordChange: (value: string) => void;
  onOpenWithPassword: () => void;
  onCloseSession: () => void;
};

export default function ControlPanelAccessCard({
  active,
  busy,
  sessionId,
  expiresAtLabel,
  actionReason,
  reauthPassword,
  reauthError,
  reauthMode,
  onActionReasonChange,
  onReauthPasswordChange,
  onOpenWithPassword,
  onCloseSession,
}: ControlPanelAccessCardProps) {
  const reasonHelper = active
    ? "Se envía en cada mutación del panel y queda registrado en auditoría."
    : "Se habilita cuando confirmes tu clave otra vez para abrir la sesión reforzada del panel.";

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
                onClick={onOpenWithPassword}
                disabled={busy || !reauthPassword.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Verificando..." : "Continuar con mi clave"}
              </button>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                Reautenticacion con clave
              </span>
            </div>
            <div>
              <label htmlFor="control-panel-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-text/70">
                Reingresa tu clave
              </label>
              <input
                id="control-panel-password"
                type="password"
                autoComplete="current-password"
                value={reauthPassword}
                onChange={(event) => onReauthPasswordChange(event.target.value)}
                placeholder="Vuelve a poner tu clave"
                className="mt-2 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
              />
              {reauthError ? <p className="mt-2 text-xs text-rose-600">{reauthError}</p> : null}
            </div>
            <p className="rounded-2xl border border-surface-border bg-surface-muted/70 px-3 py-3 text-sm text-text/75">
              {reauthMode === "real"
                ? "El panel valida la clave actual del usuario autenticado antes de abrir la sesion reforzada. Asi mantenemos la presentacion estable sin depender de OTP ni passkeys."
                : "Para la demo el panel usa una confirmacion visual de clave antes de habilitar cambios sensibles. Esto estabiliza la presentacion sin afirmar una proteccion backend adicional distinta a la sesion actual."}
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
