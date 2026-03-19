type BrandingPresetRow = {
  id: number;
  slug: string;
  name: string;
  tokens_json: Record<string, string>;
};

type BrandingConfigRow = {
  branding_preset: string;
  branding_preset_name: string;
  tokens: Record<string, string>;
  updated_at: string | null;
};

type QuotaRow = {
  category: string;
  limit: number;
  used: number;
  remaining: number;
  last_action_at: string | null;
};

type BrandingSectionProps = {
  busy: boolean;
  sessionActive: boolean;
  brandingConfig: BrandingConfigRow | null;
  brandingPresets: BrandingPresetRow[];
  quotaRows: QuotaRow[];
  formatDate: (value?: string | null) => string;
  onApplyPreset: (presetSlug: string) => void;
};

export default function BrandingSection({
  busy,
  sessionActive,
  brandingConfig,
  brandingPresets,
  quotaRows,
  formatDate,
  onApplyPreset,
}: BrandingSectionProps) {
  return (
    <div className="space-y-4">
      <div className="sadi-subtle-panel rounded-3xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Preset activo</h3>
            <p className="sadi-text-soft text-xs">
              {brandingConfig
                ? `${brandingConfig.branding_preset_name} (${brandingConfig.branding_preset})`
                : "Abre la sesión reforzada para cargar la identidad visual."}
            </p>
          </div>
          {brandingConfig?.updated_at ? (
            <span className="text-xs text-text/60">Actualizado: {formatDate(brandingConfig.updated_at)}</span>
          ) : null}
        </div>
        {brandingConfig ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(brandingConfig.tokens).map(([token, value]) => (
              <div key={token} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full border border-surface-border" style={{ backgroundColor: value }} />
                  <div>
                    <p className="text-xs font-semibold text-text">{token}</p>
                    <p className="font-mono text-xs text-text/70">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr] 2xl:grid-cols-[1.2fr,0.8fr]">
        <div className="grid gap-4 xl:grid-cols-2">
          {brandingPresets.map((preset) => {
            const selected = brandingConfig?.branding_preset === preset.slug;
            return (
              <article
                key={preset.id}
                className={`rounded-3xl border p-4 ${selected ? "border-primary bg-primary/5" : "border-surface-border bg-surface-muted/60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-text">{preset.name}</h4>
                    <p className="text-xs text-text/60">{preset.slug}</p>
                  </div>
                  {selected ? <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-white">Activo</span> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
                  {Object.entries(preset.tokens_json).map(([token, value]) => (
                    <div key={token} className="rounded-xl border border-surface-border p-2">
                      <div className="h-8 rounded-lg border border-surface-border" style={{ backgroundColor: value }} />
                      <p className="mt-2 truncate text-[11px] font-medium text-text/70">{token}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={busy || selected || !sessionActive}
                    onClick={() => onApplyPreset(preset.slug)}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {selected ? "Aplicado" : "Aplicar preset"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="sadi-subtle-panel rounded-3xl p-4">
          <h3 className="text-sm font-semibold text-text">Cuotas del panel</h3>
          <div className="mt-3 space-y-3">
            {quotaRows.map((row) => (
              <div key={row.category} className="rounded-xl border border-surface-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text">{row.category}</span>
                  <span className="text-xs text-text/60">
                    {row.used}/{row.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round((row.used / Math.max(1, row.limit)) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-text/60">
                  Restantes: {row.remaining} {row.last_action_at ? `| Último cambio ${formatDate(row.last_action_at)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
