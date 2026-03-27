"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import {
  BrandingSection,
  ControlPanelAccessCard,
  PermissionsSection,
  RolesSection,
  SedesSection,
} from "@/components/admin/control-center";
import {
  buildControlPanelHeaders,
  buildDomainRulePayload,
  type DomainScope,
  validateControlPanelReason,
} from "@/lib/control-center";
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

const sectionDetails: Record<SectionKey, { eyebrow: string; description: string }> = {
  branding: {
    eyebrow: "Configuracion central",
    description: "Gestiona presets, tokens activos y cuotas del panel.",
  },
  sedes: {
    eyebrow: "Cobertura institucional",
    description: "Administra catalogo, estados y datos base de las sedes.",
  },
  roles: {
    eyebrow: "Gobierno RBAC",
    description: "Define la estructura de roles disponible para el sistema.",
  },
  permisos: {
    eyebrow: "Mapa de acciones",
    description: "Controla permisos explicitamente mapeados para cada flujo.",
  },
  asignaciones: {
    eyebrow: "Enlace operativo",
    description: "Relaciona roles, permisos y alcance efectivo.",
  },
  dominios: {
    eyebrow: "Politica institucional",
    description: "Aplica reglas de dominio con alcance global, por rol o por sede.",
  },
  auditoria: {
    eyebrow: "Trazabilidad",
    description: "Revisa eventos recientes y cambios ejecutados desde el panel.",
  },
};

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
    return buildControlPanelHeaders(controlPanelSession.session?.id, reason ?? actionReason);
  }

  function ensureReason(reason?: string): boolean {
    const validationError = validateControlPanelReason(reason ?? actionReason);
    if (!validationError) return true;
    setFormErrors([validationError]);
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
  const activeSectionMeta = useMemo(
    () => sections.find((section) => section.key === activeSection) ?? sections[0],
    [activeSection],
  );

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
      setFormErrors(["Solicita el código e ingrésalo para abrir la sesión reforzada."]);
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
      setFormErrors(["Tu navegador no soporta Passkeys/WebAuthn para abrir la sesión reforzada."]);
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
      setFormErrors(["Debes completar código y nombre de sede."]);
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
      setFormErrors(["Debes completar código y nombre del rol."]);
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
      setFormErrors(["Debes completar código y nombre del permiso."]);
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
    const result = buildDomainRulePayload({
      domain: domainFormValue,
      scope: domainFormScope,
      role: domainFormRole,
      sede: domainFormSede,
      isActive: domainFormActive,
    });
    if (!result.ok) {
      setFormErrors([result.error]);
      return null;
    }
    return result.payload;
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
    <div className="space-y-5">
      <header className="sadi-card rounded-[30px] p-5 sm:p-6">
        <div className="space-y-5">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Modulo ejecutivo
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-text sm:text-[2rem]">
                Superadmin / Centro de control
              </h1>
              <p className="max-w-4xl text-sm leading-6 text-text/72">
                Gestion centralizada de sedes, politicas RBAC, dominios y auditoria. La navegacion organiza el dominio que administras y la validacion reforzada acompana los cambios sensibles.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr,1fr,1.1fr]">
            <div className="rounded-[22px] border border-surface-border bg-surface-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text/50">Sesion</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${controlPanelSession.active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                <p className="text-sm font-semibold text-text">
                  {controlPanelSession.active ? "Reforzada activa para cambios sensibles" : "Validacion pendiente para operar"}
                </p>
              </div>
            </div>
            <div className="rounded-[22px] border border-surface-border bg-surface-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text/50">Seccion activa</p>
              <p className="mt-2 text-sm font-semibold text-text">{activeSectionMeta.label}</p>
              <p className="mt-1 text-sm text-text/65">{sectionDetails[activeSectionMeta.key].eyebrow}</p>
            </div>
            <div className="rounded-[22px] border border-surface-border bg-surface-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text/50">Motivo</p>
              <p className="mt-2 text-sm font-semibold text-text">
                {actionReason.trim() ? "Contexto documentado para auditoria" : "Aun no se ha documentado el cambio"}
              </p>
              <p className="mt-1 text-sm text-text/65">
                {actionReason.trim() ? "El proceso operativo ya tiene contexto de negocio." : "Se solicitara antes de ejecutar mutaciones del panel."}
              </p>
            </div>
          </div>
        </div>
      </header>


      {formErrors.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ul className="list-disc pl-5">
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-5">
        <section className="sadi-card rounded-[28px] p-4 sm:p-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">Navegacion interna</p>
              <h2 className="text-base font-semibold text-text">Secciones del panel</h2>
              <p className="text-sm text-text/68">
                La navegacion organiza el centro de control y define el dominio que estas administrando.
              </p>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sections.map((section, index) => {
                const active = section.key === activeSection;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`group min-w-[220px] shrink-0 rounded-[22px] border px-4 py-3 text-left transition sm:min-w-[240px] ${
                      active
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-surface-border bg-surface-muted/60 text-text hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${active ? "text-white/75" : "text-text/45"}`}>
                          {sectionDetails[section.key].eyebrow}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{section.label}</p>
                        <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-text/60"}`}>
                          {sectionDetails[section.key].description}
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          active ? "bg-white/16 text-white" : "bg-surface text-text/65"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="sadi-card rounded-[28px] p-4 sm:p-5">
          <div className="border-b border-surface-border pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  {sectionDetails[activeSectionMeta.key].eyebrow}
                </p>
                <h2 className="text-xl font-semibold text-text">{activeSectionMeta.label}</h2>
                <p className="max-w-3xl text-sm text-text/70">
                  {sectionDetails[activeSectionMeta.key].description}
                </p>
              </div>
              <div className="rounded-full border border-surface-border bg-surface-muted/40 px-3 py-1.5 text-xs font-medium text-text/60">
                Contenido activo
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
          {activeSection === "branding" ? (
            <BrandingSection
              busy={busy}
              sessionActive={controlPanelSession.active}
              brandingConfig={brandingConfig}
              brandingPresets={brandingPresets}
              quotaRows={quotaRows}
              formatDate={formatDate}
              onApplyPreset={applyBrandingPreset}
            />
          ) : null}

          {activeSection === "sedes" ? (
            <SedesSection
              busy={busy}
              sedes={sedes}
              createSedeCode={createSedeCode}
              createSedeName={createSedeName}
              editingSedeId={editingSedeId}
              editingSedeCode={editingSedeCode}
              editingSedeName={editingSedeName}
              editingSedeActive={editingSedeActive}
              fieldError={fieldError}
              formatDate={formatDate}
              setCreateSedeCode={setCreateSedeCode}
              setCreateSedeName={setCreateSedeName}
              setEditingSedeId={setEditingSedeId}
              setEditingSedeCode={setEditingSedeCode}
              setEditingSedeName={setEditingSedeName}
              setEditingSedeActive={setEditingSedeActive}
              clearFieldErrors={(field) => setFieldErrors((prev) => ({ ...prev, [field]: [] }))}
              submitCreateSede={submitCreateSede}
              submitEditSede={submitEditSede}
              openEditSede={openEditSede}
              deactivateSede={deactivateSede}
            />
          ) : null}

          {activeSection === "roles" ? (
            <RolesSection
              busy={busy}
              roles={roles}
              roleCode={roleCode}
              roleName={roleName}
              setRoleCode={setRoleCode}
              setRoleName={setRoleName}
              submitCreateRole={submitCreateRole}
            />
          ) : null}

          {activeSection === "permisos" ? (
            <PermissionsSection
              busy={busy}
              permissions={permissions}
              permissionCode={permissionCode}
              permissionName={permissionName}
              permissionDescription={permissionDescription}
              setPermissionCode={setPermissionCode}
              setPermissionName={setPermissionName}
              setPermissionDescription={setPermissionDescription}
              submitCreatePermission={submitCreatePermission}
            />
          ) : null}

          {activeSection === "asignaciones" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-text">
                  {domainFormId ? `Editar regla #${domainFormId}` : "Nueva regla de dominio"}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          </div>
          </div>

          <ControlPanelAccessCard
            active={controlPanelSession.active}
            busy={busy}
            passkeySupported={passkeySupported}
            otpRequestId={otpRequestId}
            otpCode={otpCode}
            sessionId={controlPanelSession.session?.id}
            expiresAtLabel={formatDate(controlPanelSession.session?.expires_at)}
            actionReason={actionReason}
            onOtpCodeChange={setOtpCode}
            onActionReasonChange={setActionReason}
            onRequestOtp={requestControlPanelOtp}
            onOpenPasskey={openControlPanelWithPasskey}
            onVerifyOtp={verifyControlPanelOtp}
            onCloseSession={closeControlPanelSession}
          />
        </section>
      </div>
    </div>
  );
}
