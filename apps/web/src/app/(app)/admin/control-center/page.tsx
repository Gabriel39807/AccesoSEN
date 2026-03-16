"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { normalizeApiErrors } from "@/lib/errors";
import { useMe } from "@/hooks/useMe";

type SectionKey = "branding" | "sedes" | "roles" | "permisos" | "asignaciones" | "dominios" | "auditoria";
type ControlPanelSessionState = {
  active: boolean;
  session: { id: string; verified_by?: string; expires_at?: string } | null;
};
type ControlPanelPasskeyOptionsResponse = {
  request_id: string;
  challenge: string;
  rp_id: string;
  timeout: number;
  allow_credentials: Array<{ credential_id: string; transports?: string[] }>;
  mock?: boolean;
};

type SedeRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string | null;
};

type RoleRow = {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
  created_at?: string | null;
};

type PermissionRow = {
  id: number;
  code: string;
  name: string;
  description?: string;
  created_at?: string | null;
};

type AssignmentRow = {
  id: number;
  role: string;
  role_name?: string;
  permission: string;
  permission_name?: string;
  scope: "GLOBAL" | "SEDE" | "OWN";
};

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
  created_by?: string | null;
};

type AuditRow = {
  id: string;
  type: string;
  timestamp: string | null;
  actor: string | null;
  detail: string;
  sede: string | null;
};

type BrandingPresetRow = {
  id: number;
  slug: string;
  name: string;
  tokens_json: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
};

type BrandingConfigRow = {
  branding_preset: string;
  branding_preset_name: string;
  tokens: Record<string, string>;
  updated_by: string | null;
  updated_at: string | null;
};

type QuotaRow = {
  category: string;
  limit: number;
  used: number;
  remaining: number;
  window_start: string;
  last_action_at: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type AuditResponse = {
  permitido?: boolean;
  results?: AuditRow[];
};

const sections: Array<{ key: SectionKey; label: string }> = [
  { key: "branding", label: "Identidad visual" },
  { key: "sedes", label: "Sedes" },
  { key: "roles", label: "Roles" },
  { key: "permisos", label: "Permisos" },
  { key: "asignaciones", label: "Asignaciones" },
  { key: "dominios", label: "Dominios" },
  { key: "auditoria", label: "Auditoría" },
];

function toRows<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload?.results ?? [];
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stringToBytes(value: string) {
  return new TextEncoder().encode(value);
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function SuperadminControlCenterPage() {
  const { me, loadingMe } = useMe();
  const [activeSection, setActiveSection] = useState<SectionKey>("branding");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [controlPanelSession, setControlPanelSession] = useState<ControlPanelSessionState>({ active: false, session: null });
  const [otpRequestId, setOtpRequestId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [actionReason, setActionReason] = useState("");

  const [sedes, setSedes] = useState<SedeRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [domains, setDomains] = useState<DomainRuleRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [brandingPresets, setBrandingPresets] = useState<BrandingPresetRow[]>([]);
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfigRow | null>(null);
  const [quotaRows, setQuotaRows] = useState<QuotaRow[]>([]);

  useEffect(() => {
    setPasskeySupported(typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials);
  }, []);

  const [createSedeCode, setCreateSedeCode] = useState("");
  const [createSedeName, setCreateSedeName] = useState("");
  const [editingSedeId, setEditingSedeId] = useState<number | null>(null);
  const [editingSedeCode, setEditingSedeCode] = useState("");
  const [editingSedeName, setEditingSedeName] = useState("");
  const [editingSedeActive, setEditingSedeActive] = useState(true);

  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");

  const [permissionCode, setPermissionCode] = useState("");
  const [permissionName, setPermissionName] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");

  const [assignmentRole, setAssignmentRole] = useState("");
  const [assignmentPermission, setAssignmentPermission] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<AssignmentRow["scope"]>("SEDE");

  const [domainFilter, setDomainFilter] = useState("");
  const [domainRoleFilter, setDomainRoleFilter] = useState("");
  const [domainSedeFilter, setDomainSedeFilter] = useState("");
  const [domainStatusFilter, setDomainStatusFilter] = useState<"" | "true" | "false">("");
  const [domainScopeFilter, setDomainScopeFilter] = useState<"" | DomainScope>("");

  const [domainFormId, setDomainFormId] = useState<number | null>(null);
  const [domainFormValue, setDomainFormValue] = useState("");
  const [domainFormScope, setDomainFormScope] = useState<DomainScope>("GLOBAL");
  const [domainFormRole, setDomainFormRole] = useState("");
  const [domainFormSede, setDomainFormSede] = useState("");
  const [domainFormActive, setDomainFormActive] = useState(true);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function clearErrors() {
    setFormErrors([]);
    setFieldErrors({});
  }

  function setApiErrors(error: unknown) {
    const normalized = normalizeApiErrors(error, "No se pudo completar la accion.");
    setFormErrors(normalized.formErrors.length ? normalized.formErrors : ["No se pudo completar la accion."]);
    setFieldErrors(normalized.fieldErrors);
  }

  function fieldError(field: string): string | null {
    return fieldErrors[field]?.[0] ?? null;
  }

  function controlPanelHeaders(reason?: string) {
    const headers: Record<string, string> = {};
    if (controlPanelSession.session?.id) {
      headers["X-Control-Panel-Session"] = controlPanelSession.session.id;
    }
    const finalReason = (reason ?? actionReason).trim();
    if (finalReason) {
      headers["X-Control-Panel-Reason"] = finalReason;
    }
    return headers;
  }

  function ensureReason(reason?: string): boolean {
    if ((reason ?? actionReason).trim()) return true;
    setFormErrors(["Debes indicar un motivo del cambio antes de modificar el panel."]);
    return false;
  }

  function notifySedesUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sedes:updated"));
    }
  }

  function notifySystemThemeUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("system-theme:refresh"));
    }
  }

  async function loadSedes() {
    const response = await api.get<SedeRow[] | Paginated<SedeRow>>("/api/sedes/", {
      params: { include_inactive: "true" },
    });
    setSedes(toRows(response.data));
  }

  async function loadRoles() {
    const response = await api.get<RoleRow[] | Paginated<RoleRow>>("/api/roles/", {
      headers: controlPanelHeaders(),
    });
    setRoles(toRows(response.data));
  }

  async function loadPermissions() {
    const response = await api.get<PermissionRow[] | Paginated<PermissionRow>>("/api/permisos/", {
      headers: controlPanelHeaders(),
    });
    setPermissions(toRows(response.data));
  }

  async function loadAssignments() {
    const response = await api.get<AssignmentRow[] | Paginated<AssignmentRow>>("/api/asignaciones/", {
      headers: controlPanelHeaders(),
    });
    setAssignments(toRows(response.data));
  }

  async function loadDomains() {
    const params: Record<string, string> = {};
    if (domainFilter.trim()) params.domain = domainFilter.trim();
    if (domainRoleFilter) params.role = domainRoleFilter;
    if (domainSedeFilter) params.sede = domainSedeFilter;
    if (domainStatusFilter) params.is_active = domainStatusFilter;
    if (domainScopeFilter) params.scope = domainScopeFilter;

    const response = await api.get<DomainRuleRow[] | Paginated<DomainRuleRow>>("/api/dominios-email/", {
      params,
      headers: controlPanelHeaders(),
    });
    setDomains(toRows(response.data));
  }

  async function loadAudit() {
    const response = await api.get<AuditResponse>("/api/auditoria/eventos/", {
      headers: controlPanelHeaders(),
    });
    setAuditRows(response.data?.results ?? []);
  }

  async function loadBranding() {
    const [presetsResponse, configResponse, quotasResponse] = await Promise.all([
      api.get<{ results: BrandingPresetRow[] }>("/api/control-panel/branding/presets/", {
        headers: controlPanelHeaders(),
      }),
      api.get<{ configuracion: BrandingConfigRow }>("/api/control-panel/branding/config/", {
        headers: controlPanelHeaders(),
      }),
      api.get<{ results: QuotaRow[] }>("/api/control-panel/quotas/", {
        headers: controlPanelHeaders(),
      }),
    ]);
    setBrandingPresets(presetsResponse.data.results ?? []);
    setBrandingConfig(configResponse.data.configuracion ?? null);
    setQuotaRows(quotasResponse.data.results ?? []);
  }

  async function loadControlPanelSessionStatus() {
    const response = await api.get<ControlPanelSessionState>("/api/control-panel/session/status/", {
      headers: controlPanelHeaders(),
    });
    setControlPanelSession({
      active: Boolean(response.data?.active),
      session: response.data?.session ?? null,
    });
  }

  async function loadControlCenter() {
    setLoading(true);
    clearErrors();
    try {
      await loadSedes();
      if (controlPanelSession.active && controlPanelSession.session?.id) {
        await Promise.all([loadBranding(), loadRoles(), loadPermissions(), loadAssignments(), loadDomains(), loadAudit()]);
      }
    } catch (error) {
      setApiErrors(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadingMe) return;
    if (me?.rol !== "superadmin") return;
    loadControlPanelSessionStatus()
      .catch(() => {
        setControlPanelSession({ active: false, session: null });
      })
      .finally(() => {
        loadControlCenter();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMe, me?.rol]);

  useEffect(() => {
    if (loadingMe) return;
    if (me?.rol !== "superadmin") return;
    if (!controlPanelSession.active) return;
    loadControlCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlPanelSession.active, controlPanelSession.session?.id]);

  useEffect(() => {
    if (loadingMe) return;
    if (me?.rol !== "superadmin") return;
    if (activeSection !== "dominios") return;
    if (!controlPanelSession.active) return;
    loadDomains().catch(setApiErrors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, controlPanelSession.active, domainFilter, domainRoleFilter, domainSedeFilter, domainStatusFilter, domainScopeFilter]);

  const sedesByCode = useMemo(() => new Map(sedes.map((sede) => [sede.code, sede.name])), [sedes]);

  if (loadingMe || loading) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface p-6 text-sm text-text/80">
        Cargando centro de control...
      </div>
    );
  }

  if (me?.rol !== "superadmin") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        No tienes permisos para acceder al centro de control.
      </div>
    );
  }

  async function requestControlPanelOtp() {
    clearErrors();
    setBusy(true);
    try {
      const response = await api.post<{ request_id: string }>("/api/control-panel/session/request-otp/", {});
      setOtpRequestId(response.data.request_id || "");
      setOtpCode("");
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function verifyControlPanelOtp() {
    clearErrors();
    if (!otpRequestId || !otpCode.trim()) {
      setFormErrors(["Solicita el OTP e ingresa el codigo para abrir la sesion reforzada."]);
      return;
    }
    setBusy(true);
    try {
      const response = await api.post<ControlPanelSessionState>(
        "/api/control-panel/session/verify-otp/",
        { request_id: otpRequestId, otp: otpCode.trim() },
      );
      setControlPanelSession({
        active: Boolean(response.data?.active),
        session: response.data?.session ?? null,
      });
      setOtpRequestId("");
      setOtpCode("");
      await loadControlCenter();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function openControlPanelWithPasskey() {
    clearErrors();
    if (!passkeySupported) {
      setFormErrors(["Tu navegador no soporta Passkeys/WebAuthn para abrir la sesion reforzada."]);
      return;
    }
    setBusy(true);
    try {
      const optionsResponse = await api.post<ControlPanelPasskeyOptionsResponse>(
        "/api/control-panel/session/request-passkey/",
        {},
      );
      const options = optionsResponse.data;
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: stringToBytes(options.challenge),
        rpId: options.rp_id,
        timeout: options.timeout || 60000,
        userVerification: "preferred",
        allowCredentials: (options.allow_credentials || []).map((credential) => ({
          type: "public-key",
          id: stringToBytes(credential.credential_id),
          transports: credential.transports as AuthenticatorTransport[] | undefined,
        })),
      };

      const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
      if (!assertion) {
        throw new Error("No fue posible obtener una credencial passkey para el panel.");
      }
      const credentialId = toBase64Url(assertion.rawId);

      const verifyResponse = await api.post<ControlPanelSessionState>(
        "/api/control-panel/session/verify-passkey/",
        {
          request_id: options.request_id,
          challenge: options.challenge,
          credential_id: credentialId,
        },
      );
      setControlPanelSession({
        active: Boolean(verifyResponse.data?.active),
        session: verifyResponse.data?.session ?? null,
      });
      await loadControlCenter();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function closeControlPanelSession() {
    clearErrors();
    setBusy(true);
    try {
      await api.post("/api/control-panel/session/close/", {}, { headers: controlPanelHeaders() });
      setControlPanelSession({ active: false, session: null });
      setBrandingConfig(null);
      setBrandingPresets([]);
      setQuotaRows([]);
      setRoles([]);
      setPermissions([]);
      setAssignments([]);
      setDomains([]);
      setAuditRows([]);
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function applyBrandingPreset(slug: string) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.patch(
        "/api/control-panel/branding/config/",
        { branding_preset: slug },
        {
          headers: controlPanelHeaders(),
        },
      );
      await Promise.all([loadBranding(), loadAudit()]);
      notifySystemThemeUpdated();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreateSede() {
    clearErrors();
    if (!createSedeCode.trim() || !createSedeName.trim()) {
      setFormErrors(["Debes completar codigo y nombre de sede."]);
      return;
    }
    if (!ensureReason()) return;

    setBusy(true);
    try {
      await api.post("/api/sedes/", {
        code: createSedeCode.trim().toLowerCase(),
        name: createSedeName.trim(),
        is_active: true,
      }, { headers: controlPanelHeaders() });
      setCreateSedeCode("");
      setCreateSedeName("");
      await loadSedes();
      notifySedesUpdated();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  function openEditSede(row: SedeRow) {
    clearErrors();
    setEditingSedeId(row.id);
    setEditingSedeCode(row.code);
    setEditingSedeName(row.name);
    setEditingSedeActive(row.is_active);
  }

  async function submitEditSede() {
    if (!editingSedeId) return;
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.patch(`/api/sedes/${editingSedeId}/`, {
        code: editingSedeCode.trim().toLowerCase(),
        name: editingSedeName.trim(),
        is_active: editingSedeActive,
      }, { headers: controlPanelHeaders() });
      setEditingSedeId(null);
      await loadSedes();
      notifySedesUpdated();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function deactivateSede(row: SedeRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.delete(`/api/sedes/${row.id}/`, { headers: controlPanelHeaders() });
      if (editingSedeId === row.id) {
        setEditingSedeId(null);
      }
      await loadSedes();
      notifySedesUpdated();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreateRole() {
    clearErrors();
    if (!roleCode.trim() || !roleName.trim()) {
      setFormErrors(["Debes completar codigo y nombre del rol."]);
      return;
    }
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.post("/api/roles/", {
        code: roleCode.trim().toLowerCase(),
        name: roleName.trim(),
        is_system: false,
      }, { headers: controlPanelHeaders() });
      setRoleCode("");
      setRoleName("");
      await loadRoles();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreatePermission() {
    clearErrors();
    if (!permissionCode.trim() || !permissionName.trim()) {
      setFormErrors(["Debes completar codigo y nombre del permiso."]);
      return;
    }
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.post("/api/permisos/", {
        code: permissionCode.trim().toLowerCase(),
        name: permissionName.trim(),
        description: permissionDescription.trim(),
      }, { headers: controlPanelHeaders() });
      setPermissionCode("");
      setPermissionName("");
      setPermissionDescription("");
      await loadPermissions();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreateAssignment() {
    clearErrors();
    if (!assignmentRole || !assignmentPermission) {
      setFormErrors(["Debes seleccionar rol, permiso y alcance."]);
      return;
    }
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.post("/api/asignaciones/", {
        role: assignmentRole,
        permission: assignmentPermission,
        scope: assignmentScope,
      }, { headers: controlPanelHeaders() });
      await loadAssignments();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(row: AssignmentRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.delete(`/api/asignaciones/${row.id}/`, { headers: controlPanelHeaders() });
      await loadAssignments();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  function resetDomainForm() {
    setDomainFormId(null);
    setDomainFormValue("");
    setDomainFormScope("GLOBAL");
    setDomainFormRole("");
    setDomainFormSede("");
    setDomainFormActive(true);
  }

  function applyDomainScopeDefaults(scope: DomainScope) {
    setDomainFormScope(scope);
    if (scope === "GLOBAL") {
      setDomainFormRole("");
      setDomainFormSede("");
      return;
    }
    if (scope === "SEDE") {
      setDomainFormRole("");
      return;
    }
    if (scope === "ROLE") {
      setDomainFormSede("");
      return;
    }
  }

  function openEditDomain(row: DomainRuleRow) {
    clearErrors();
    setDomainFormId(row.id);
    setDomainFormValue(row.domain);
    setDomainFormScope(row.scope);
    setDomainFormRole(row.role || "");
    setDomainFormSede(row.sede || "");
    setDomainFormActive(row.is_active);
  }

  function buildDomainPayload() {
    const domain = domainFormValue.trim().toLowerCase().replace("@", "");
    if (!domain) {
      setFormErrors(["Debes indicar un dominio, por ejemplo empresa.com."]);
      return null;
    }

    const payload: Record<string, unknown> = {
      domain,
      is_active: domainFormActive,
      role: null,
      sede: null,
    };

    if (domainFormScope === "ROLE" || domainFormScope === "ROLE_SEDE") {
      if (!domainFormRole) {
        setFormErrors(["Selecciona un rol para el alcance elegido."]);
        return null;
      }
      payload.role = domainFormRole;
    }

    if (domainFormScope === "SEDE" || domainFormScope === "ROLE_SEDE") {
      if (!domainFormSede) {
        setFormErrors(["Selecciona una sede para el alcance elegido."]);
        return null;
      }
      payload.sede = domainFormSede;
    }

    return payload;
  }

  async function submitDomainRule() {
    clearErrors();
    const payload = buildDomainPayload();
    if (!payload) return;
    if (!ensureReason()) return;

    setBusy(true);
    try {
      if (domainFormId) {
        await api.patch(`/api/dominios-email/${domainFormId}/`, payload, { headers: controlPanelHeaders() });
      } else {
        await api.post("/api/dominios-email/", payload, { headers: controlPanelHeaders() });
      }
      resetDomainForm();
      await loadDomains();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDomainRule(row: DomainRuleRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.patch(
        `/api/dominios-email/${row.id}/`,
        { is_active: !row.is_active },
        { headers: controlPanelHeaders() },
      );
      await loadDomains();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDomainRule(row: DomainRuleRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.delete(`/api/dominios-email/${row.id}/`, { headers: controlPanelHeaders() });
      if (domainFormId === row.id) {
        resetDomainForm();
      }
      await loadDomains();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <h1 className="text-2xl font-bold text-primary">Superadmin / Centro de control</h1>
        <p className="text-sm text-text/70">
          Gestión centralizada de sedes, RBAC y visibilidad de auditoría.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Sesión reforzada del panel</h2>
              <p className="text-xs text-text/70">
                {controlPanelSession.active
                  ? `Activa hasta ${formatDate(controlPanelSession.session?.expires_at)}`
                  : "Abre una sesión reforzada para operar identidad visual, permisos, dominios y auditoría."}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                controlPanelSession.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {controlPanelSession.active ? "Activa" : "Cerrada"}
            </span>
          </div>

          {!controlPanelSession.active ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[auto,1fr,auto]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={requestControlPanelOtp}
                  disabled={busy}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Enviando..." : otpRequestId ? "Reenviar código" : "Enviar código"}
                </button>
                <button
                  type="button"
                  onClick={openControlPanelWithPasskey}
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
                onChange={(event) => setOtpCode(event.target.value)}
              />
              <button
                type="button"
                onClick={verifyControlPanelOtp}
                disabled={busy || !otpRequestId}
                className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
              >
                Verificar
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                Sesión: {controlPanelSession.session?.id?.slice(0, 8)}...
              </div>
              <button
                type="button"
                onClick={closeControlPanelSession}
                disabled={busy}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm font-semibold hover:bg-primary/10 disabled:opacity-60"
              >
                Cerrar sesión reforzada
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text">Motivo del cambio</h2>
          <p className="mt-1 text-xs text-text/70">
            Se envía en cada mutación del panel y queda registrado en auditoría.
          </p>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
            placeholder="Ej: Activar identidad visual del cliente para campus norte"
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
          />
        </div>
      </div>

      {formErrors.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ul className="list-disc pl-5">
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
        <aside className="rounded-2xl border border-surface-border bg-surface p-3">
          <div className="space-y-2">
            {sections.map((section) => {
              const active = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    active ? "bg-primary text-white" : "bg-surface text-text hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-4 rounded-2xl border border-surface-border bg-surface p-4">
          {activeSection === "branding" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text">Preset activo</h3>
                    <p className="text-xs text-text/70">
                      {brandingConfig
                        ? `${brandingConfig.branding_preset_name} (${brandingConfig.branding_preset})`
                        : "Abre la sesión reforzada para cargar la identidad visual."}
                    </p>
                  </div>
                  {brandingConfig?.updated_at ? (
                    <span className="text-xs text-text/60">
                      Actualizado: {formatDate(brandingConfig.updated_at)}
                    </span>
                  ) : null}
                </div>
                {brandingConfig ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
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

              <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  {brandingPresets.map((preset) => {
                    const selected = brandingConfig?.branding_preset === preset.slug;
                    return (
                      <article
                        key={preset.id}
                        className={`rounded-2xl border p-4 ${
                          selected ? "border-primary bg-primary/5" : "border-surface-border bg-surface"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-text">{preset.name}</h4>
                            <p className="text-xs text-text/60">{preset.slug}</p>
                          </div>
                          {selected ? (
                            <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-white">Activo</span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
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
                            disabled={busy || selected || !controlPanelSession.active}
                            onClick={() => applyBrandingPreset(preset.slug)}
                            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                          >
                            {selected ? "Aplicado" : "Aplicar preset"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-surface-border bg-surface p-4">
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
          ) : null}

          {activeSection === "sedes" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-text/70">Código de sede</label>
                  <input
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                    value={createSedeCode}
                    onChange={(event) => {
                      setCreateSedeCode(event.target.value);
                      setFieldErrors((prev) => ({ ...prev, code: [] }));
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
                      setFieldErrors((prev) => ({ ...prev, name: [] }));
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
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
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
          ) : null}

          {activeSection === "roles" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  placeholder="código del rol"
                  value={roleCode}
                  onChange={(event) => setRoleCode(event.target.value)}
                />
                <input
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  placeholder="nombre del rol"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={submitCreateRole}
                  disabled={busy}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Guardando..." : "Crear rol"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-surface-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
                    <tr className="text-left">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((row) => (
                      <tr key={row.id} className="border-t border-surface-border">
                        <td className="px-3 py-2 font-mono">{row.code}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.is_system ? "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeSection === "permisos" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  placeholder="código del permiso"
                  value={permissionCode}
                  onChange={(event) => setPermissionCode(event.target.value)}
                />
                <input
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  placeholder="nombre del permiso"
                  value={permissionName}
                  onChange={(event) => setPermissionName(event.target.value)}
                />
              </div>
              <textarea
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                placeholder="descripción (opcional)"
                value={permissionDescription}
                onChange={(event) => setPermissionDescription(event.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={submitCreatePermission}
                  disabled={busy}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Guardando..." : "Crear permiso"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-surface-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
                    <tr className="text-left">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((row) => (
                      <tr key={row.id} className="border-t border-surface-border">
                        <td className="px-3 py-2 font-mono">{row.code}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeSection === "asignaciones" ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  value={assignmentRole}
                  onChange={(event) => setAssignmentRole(event.target.value)}
                >
                  <option value="">Selecciona rol</option>
                  {roles.map((row) => (
                    <option key={row.id} value={row.code}>
                      {row.name} ({row.code})
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  value={assignmentPermission}
                  onChange={(event) => setAssignmentPermission(event.target.value)}
                >
                  <option value="">Selecciona permiso</option>
                  {permissions.map((row) => (
                    <option key={row.id} value={row.code}>
                      {row.name} ({row.code})
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                  value={assignmentScope}
                  onChange={(event) => setAssignmentScope(event.target.value as AssignmentRow["scope"])}
                >
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="SEDE">SEDE</option>
                  <option value="OWN">OWN</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={submitCreateAssignment}
                  disabled={busy}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Guardando..." : "Asignar permiso"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-surface-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
                    <tr className="text-left">
                      <th className="px-3 py-2">Rol</th>
                      <th className="px-3 py-2">Permiso</th>
                      <th className="px-3 py-2">Alcance</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((row) => (
                      <tr key={row.id} className="border-t border-surface-border">
                        <td className="px-3 py-2">{row.role_name || row.role}</td>
                        <td className="px-3 py-2">{row.permission_name || row.permission}</td>
                        <td className="px-3 py-2">{row.scope}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeAssignment(row)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeSection === "dominios" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Las reglas de dominio activas se aplican en todo el producto.
              </div>

              <div className="grid gap-3 md:grid-cols-5">
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

              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-text">
                  {domainFormId ? `Editar regla #${domainFormId}` : "Nueva regla de dominio"}
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
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
                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={domainFormActive}
                    onChange={(event) => setDomainFormActive(event.target.checked)}
                  />
                  Regla activa
                </label>

                <div className="mt-3 flex justify-end gap-2">
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
                    onClick={submitDomainRule}
                    disabled={busy}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy ? "Guardando..." : domainFormId ? "Guardar regla" : "Crear regla"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-surface-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-primary/10 text-primary">
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
                          No hay reglas de dominio para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      domains.map((row) => (
                        <tr key={row.id} className="border-t border-surface-border">
                          <td className="px-3 py-2 font-mono">{row.domain}</td>
                          <td className="px-3 py-2">{row.scope}</td>
                          <td className="px-3 py-2">{row.role_name || row.role || "-"}</td>
                          <td className="px-3 py-2">{row.sede_name || row.sede || "-"}</td>
                          <td className="px-3 py-2">
                            {row.is_active ? (
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Activa</span>
                            ) : (
                              <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">Inactiva</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{formatDate(row.updated_at || row.created_at)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-2">
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
          ) : null}

          {activeSection === "auditoria" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={loadAudit}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm font-semibold hover:bg-primary/10"
              >
                Recargar auditoría
              </button>

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
                        <tr key={row.id} className="border-t border-surface-border">
                          <td className="px-3 py-2">{formatDate(row.timestamp)}</td>
                          <td className="px-3 py-2">{row.type}</td>
                          <td className="px-3 py-2">{row.actor || "-"}</td>
                          <td className="px-3 py-2">
                            {row.sede ? sedesByCode.get(row.sede) || row.sede : "-"}
                          </td>
                          <td className="px-3 py-2">{row.detail}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
