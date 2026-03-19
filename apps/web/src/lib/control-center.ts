export type DomainScope = "GLOBAL" | "SEDE" | "ROLE" | "ROLE_SEDE";

export type DomainRuleFormState = {
  domain: string;
  scope: DomainScope;
  role: string;
  sede: string;
  isActive: boolean;
};

export type DomainRulePayload = {
  domain: string;
  is_active: boolean;
  role: string | null;
  sede: string | null;
};

export function buildControlPanelHeaders(sessionId?: string | null, reason?: string | null) {
  const headers: Record<string, string> = {};
  const trimmedSessionId = String(sessionId || "").trim();
  const trimmedReason = String(reason || "").trim();

  if (trimmedSessionId) headers["X-Control-Panel-Session"] = trimmedSessionId;
  if (trimmedReason) headers["X-Control-Panel-Reason"] = trimmedReason;

  return headers;
}

export function validateControlPanelReason(reason?: string | null) {
  return String(reason || "").trim() ? null : "Debes indicar un motivo del cambio antes de modificar el panel.";
}

export function normalizeDomainValue(domain: string) {
  return domain.trim().toLowerCase().replace(/^@+/, "");
}

export function buildDomainRulePayload(form: DomainRuleFormState) {
  const domain = normalizeDomainValue(form.domain);
  if (!domain) {
    return { ok: false as const, error: "Debes indicar un dominio, por ejemplo empresa.com." };
  }

  if ((form.scope === "ROLE" || form.scope === "ROLE_SEDE") && !form.role) {
    return { ok: false as const, error: "Selecciona un rol para el alcance elegido." };
  }

  if ((form.scope === "SEDE" || form.scope === "ROLE_SEDE") && !form.sede) {
    return { ok: false as const, error: "Selecciona una sede para el alcance elegido." };
  }

  return {
    ok: true as const,
    payload: {
      domain,
      is_active: form.isActive,
      role: form.scope === "ROLE" || form.scope === "ROLE_SEDE" ? form.role : null,
      sede: form.scope === "SEDE" || form.scope === "ROLE_SEDE" ? form.sede : null,
    } satisfies DomainRulePayload,
  };
}
