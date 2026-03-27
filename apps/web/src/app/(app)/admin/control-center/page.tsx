"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import {
  AssignmentsSection,
  AuditSection,
  BrandingSection,
  ControlPanelAccessCard,
  DominiosManager,
  DominiosSection,
  PermissionsSection,
  ProgramasManager,
  ProgramasSection,
  RolesSection,
  SedesManager,
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

type SectionKey = "branding" | "sedes" | "programas" | "roles" | "permisos" | "asignaciones" | "dominios" | "auditoria";
type ControlPanelSessionState = {
  active: boolean;
  session: { id: string; verified_by?: string; expires_at?: string } | null;
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

type ProgramRow = {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  active_users_count?: number;
  can_delete?: boolean;
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
  { key: "programas", label: "Programas" },
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

function hasActiveControlPanelSession(state?: ControlPanelSessionState | null) {
  return Boolean(state?.active && state?.session?.id);
}

export default function SuperadminControlCenterPage() {
  const { me, loadingMe } = useMe();
  const [activeSection, setActiveSection] = useState<SectionKey>("branding");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [controlPanelSession, setControlPanelSession] = useState<ControlPanelSessionState>({ active: false, session: null });
  const [actionReason, setActionReason] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");

  const [sedes, setSedes] = useState<SedeRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [domains, setDomains] = useState<DomainRuleRow[]>([]);
  const [programas, setProgramas] = useState<ProgramRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [brandingPresets, setBrandingPresets] = useState<BrandingPresetRow[]>([]);
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfigRow | null>(null);
  const [quotaRows, setQuotaRows] = useState<QuotaRow[]>([]);

  const [createSedeCode, setCreateSedeCode] = useState("");
  const [createSedeName, setCreateSedeName] = useState("");
  const [editingSedeId, setEditingSedeId] = useState<number | null>(null);
  const [editingSedeCode, setEditingSedeCode] = useState("");
  const [editingSedeName, setEditingSedeName] = useState("");
  const [editingSedeActive, setEditingSedeActive] = useState(true);

  const [programFormId, setProgramFormId] = useState<number | null>(null);
  const [programFormName, setProgramFormName] = useState("");
  const [programFormActive, setProgramFormActive] = useState(true);
  const [sedeModalOpen, setSedeModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);

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

  function updateReauthPassword(value: string) {
    setReauthPassword(value);
    setFieldErrors((prev) => {
      if (!prev.password?.length) return prev;
      return { ...prev, password: [] };
    });
  }

  function controlPanelHeaders(reason?: string, sessionOverride?: ControlPanelSessionState | null) {
    return buildControlPanelHeaders(sessionOverride?.session?.id ?? controlPanelSession.session?.id, reason ?? actionReason);
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

  async function loadRoles(sessionOverride?: ControlPanelSessionState | null) {
    const response = await api.get<RoleRow[] | Paginated<RoleRow>>("/api/roles/", {
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setRoles(toRows(response.data));
  }

  async function loadPermissions(sessionOverride?: ControlPanelSessionState | null) {
    const response = await api.get<PermissionRow[] | Paginated<PermissionRow>>("/api/permisos/", {
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setPermissions(toRows(response.data));
  }

  async function loadAssignments(sessionOverride?: ControlPanelSessionState | null) {
    const response = await api.get<AssignmentRow[] | Paginated<AssignmentRow>>("/api/asignaciones/", {
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setAssignments(toRows(response.data));
  }

  async function loadDomains(sessionOverride?: ControlPanelSessionState | null) {
    const params: Record<string, string> = {};
    if (domainFilter.trim()) params.domain = domainFilter.trim();
    if (domainRoleFilter) params.role = domainRoleFilter;
    if (domainSedeFilter) params.sede = domainSedeFilter;
    if (domainStatusFilter) params.is_active = domainStatusFilter;
    if (domainScopeFilter) params.scope = domainScopeFilter;

    const response = await api.get<DomainRuleRow[] | Paginated<DomainRuleRow>>("/api/dominios-email/", {
      params,
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setDomains(toRows(response.data));
  }

  async function loadPrograms(sessionOverride?: ControlPanelSessionState | null) {
    const response = await api.get<ProgramRow[] | Paginated<ProgramRow>>("/api/programas-formacion/", {
      params: { include_inactive: "true" },
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setProgramas(toRows(response.data));
  }

  async function loadAudit(sessionOverride?: ControlPanelSessionState | null) {
    const response = await api.get<AuditResponse>("/api/auditoria/eventos/", {
      headers: controlPanelHeaders(undefined, sessionOverride),
    });
    setAuditRows(response.data?.results ?? []);
  }

  async function loadBranding(sessionOverride?: ControlPanelSessionState | null) {
    const [presetsResponse, configResponse, quotasResponse] = await Promise.all([
      api.get<{ results: BrandingPresetRow[] }>("/api/control-panel/branding/presets/", {
        headers: controlPanelHeaders(undefined, sessionOverride),
      }),
      api.get<{ configuracion: BrandingConfigRow }>("/api/control-panel/branding/config/", {
        headers: controlPanelHeaders(undefined, sessionOverride),
      }),
      api.get<{ results: QuotaRow[] }>("/api/control-panel/quotas/", {
        headers: controlPanelHeaders(undefined, sessionOverride),
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
    const nextState = {
      active: Boolean(response.data?.active),
      session: response.data?.session ?? null,
    };
    setControlPanelSession(nextState);
    return nextState;
  }

  async function loadControlCenter(sessionOverride?: ControlPanelSessionState | null) {
    setLoading(true);
    clearErrors();
    try {
      await loadSedes();
      if (hasActiveControlPanelSession(sessionOverride ?? controlPanelSession)) {
        await Promise.all([
          loadBranding(sessionOverride),
          loadRoles(sessionOverride),
          loadPermissions(sessionOverride),
          loadAssignments(sessionOverride),
          loadDomains(sessionOverride),
          loadPrograms(sessionOverride),
          loadAudit(sessionOverride),
        ]);
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
    let mounted = true;
    loadControlPanelSessionStatus()
      .then((sessionState) => {
        if (!mounted) return;
        return loadControlCenter(sessionState);
      })
      .catch(() => {
        if (!mounted) return;
        setControlPanelSession({ active: false, session: null });
        return loadControlCenter({ active: false, session: null });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMe, me?.rol]);

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

  async function openControlPanelWithPassword() {
    clearErrors();
    if (!reauthPassword.trim()) {
      setFormErrors(["Debes volver a ingresar tu clave para continuar."]);
      return;
    }
    setBusy(true);
    try {
      const verifyResponse = await api.post<ControlPanelSessionState>(
        "/api/control-panel/session/verify-password/",
        {
          password: reauthPassword,
        },
      );
      const nextSession = {
        active: Boolean(verifyResponse.data?.active),
        session: verifyResponse.data?.session ?? null,
      };
      setControlPanelSession(nextSession);
      setReauthPassword("");
      await loadControlCenter(nextSession);
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  const secureSessionRequiredLabels: Record<SectionKey, string> = {
    branding: "identidad visual y cuotas",
    sedes: "gestion de sedes",
    programas: "catalogo de programas",
    roles: "roles y permisos",
    permisos: "permisos del sistema",
    asignaciones: "asignaciones RBAC",
    dominios: "reglas de dominio",
    auditoria: "auditoria del panel",
  };

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
      setProgramas([]);
      setSedeModalOpen(false);
      setProgramModalOpen(false);
      setDomainModalOpen(false);
      resetProgramForm();
      resetDomainForm();
      setEditingSedeId(null);
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
      setSedeModalOpen(true);
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
    setSedeModalOpen(true);
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
      setSedeModalOpen(true);
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
      setSedeModalOpen(true);
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
    setDomainModalOpen(true);
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
      setDomainModalOpen(true);
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
      setDomainModalOpen(true);
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
      setDomainModalOpen(true);
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  function resetProgramForm() {
    setProgramFormId(null);
    setProgramFormName("");
    setProgramFormActive(true);
  }

  function openSedeModal() {
    clearErrors();
    setSedeModalOpen(true);
  }

  function closeSedeModal() {
    if (busy) return;
    setSedeModalOpen(false);
    setEditingSedeId(null);
  }

  function openDomainModal() {
    clearErrors();
    setDomainModalOpen(true);
  }

  function closeDomainModal() {
    if (busy) return;
    setDomainModalOpen(false);
    resetDomainForm();
  }

  function openProgramModal() {
    clearErrors();
    setProgramModalOpen(true);
  }

  function closeProgramModal() {
    if (busy) return;
    setProgramModalOpen(false);
    resetProgramForm();
  }

  function openEditProgram(row: ProgramRow) {
    clearErrors();
    setProgramFormId(row.id);
    setProgramFormName(row.name);
    setProgramFormActive(row.is_active);
    setProgramModalOpen(true);
  }

  async function submitProgram() {
    clearErrors();
    if (!programFormName.trim()) {
      setFormErrors(["Debes indicar el nombre del programa."]);
      return;
    }
    if (!ensureReason()) return;

    setBusy(true);
    try {
      const payload = { name: programFormName.trim(), is_active: programFormActive };
      if (programFormId) {
        await api.patch(`/api/programas-formacion/${programFormId}/`, payload, { headers: controlPanelHeaders() });
      } else {
        await api.post("/api/programas-formacion/", payload, { headers: controlPanelHeaders() });
      }
      resetProgramForm();
      await loadPrograms();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleProgram(row: ProgramRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.patch(
        `/api/programas-formacion/${row.id}/`,
        { is_active: !row.is_active },
        { headers: controlPanelHeaders() },
      );
      await loadPrograms();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProgram(row: ProgramRow) {
    clearErrors();
    if (!ensureReason()) return;
    setBusy(true);
    try {
      await api.delete(`/api/programas-formacion/${row.id}/`, { headers: controlPanelHeaders() });
      if (programFormId === row.id) {
        resetProgramForm();
      }
      await loadPrograms();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="sadi-card rounded-3xl p-4 sm:p-5">
        <h1 className="text-2xl font-bold text-primary">Superadmin / Centro de control</h1>
        <p className="sadi-text-soft text-sm">
          Gestión centralizada de sedes, programas aceptados, RBAC y visibilidad de auditoría.
        </p>
      </div>

      <ControlPanelAccessCard
        active={controlPanelSession.active}
        busy={busy}
        sessionId={controlPanelSession.session?.id}
        expiresAtLabel={formatDate(controlPanelSession.session?.expires_at)}
        actionReason={actionReason}
        reauthPassword={reauthPassword}
        reauthError={fieldError("password")}
        reauthMode="real"
        onActionReasonChange={setActionReason}
        onReauthPasswordChange={updateReauthPassword}
        onOpenWithPassword={openControlPanelWithPassword}
        onCloseSession={closeControlPanelSession}
      />


      {formErrors.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ul className="list-disc pl-5">
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px,minmax(0,1fr)] 2xl:grid-cols-[300px,minmax(0,1fr)]">
        <aside className="sadi-card rounded-3xl p-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:block xl:space-y-2 xl:overflow-visible xl:px-0 xl:pb-0">
            {sections.map((section) => {
              const active = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition xl:w-full ${
                    active ? "bg-primary text-white shadow-sm" : "bg-surface-muted text-text hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-4 sadi-card rounded-3xl p-4 sm:p-5">
          {!controlPanelSession.active ? (
            <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                    Sesión reforzada requerida
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-text">Activa el acceso protegido desde la tarjeta superior</h2>
                    <p className="mt-1 max-w-2xl text-sm text-text/75">
                      La vista de {secureSessionRequiredLabels[activeSection]} se carga apenas confirmas tu clave en la tarjeta superior. Dejamos un solo punto de reautenticación para evitar duplicidad y hacer el flujo más claro.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm text-text/75 shadow-sm">
                  <p className="font-semibold text-text">Flujo</p>
                  <p className="mt-1">1. Reingresa tu clave. 2. Se abre la sesión reforzada. 3. Esta sección carga sus opciones protegidas.</p>
                </div>
              </div>
            </div>
          ) : null}

          {controlPanelSession.active && activeSection === "branding" ? (
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

          {controlPanelSession.active && activeSection === "sedes" ? (
            <SedesSection
              busy={busy}
              sedes={sedes}
              formatDate={formatDate}
              openSedeModal={openSedeModal}
              openEditSede={openEditSede}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "programas" ? (
            <ProgramasSection
              busy={busy}
              programas={programas}
              formatDate={formatDate}
              openProgramModal={openProgramModal}
              openEditProgram={openEditProgram}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "roles" ? (
            <RolesSection
              busy={busy}
              roles={roles}
              roleCode={roleCode}
              roleName={roleName}
              formatDate={formatDate}
              setRoleCode={setRoleCode}
              setRoleName={setRoleName}
              submitCreateRole={submitCreateRole}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "permisos" ? (
            <PermissionsSection
              busy={busy}
              permissions={permissions}
              permissionCode={permissionCode}
              permissionName={permissionName}
              permissionDescription={permissionDescription}
              formatDate={formatDate}
              setPermissionCode={setPermissionCode}
              setPermissionName={setPermissionName}
              setPermissionDescription={setPermissionDescription}
              submitCreatePermission={submitCreatePermission}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "asignaciones" ? (
            <AssignmentsSection
              busy={busy}
              assignments={assignments}
              roles={roles}
              permissions={permissions}
              assignmentRole={assignmentRole}
              assignmentPermission={assignmentPermission}
              assignmentScope={assignmentScope}
              setAssignmentRole={setAssignmentRole}
              setAssignmentPermission={setAssignmentPermission}
              setAssignmentScope={setAssignmentScope}
              submitCreateAssignment={submitCreateAssignment}
              removeAssignment={removeAssignment}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "dominios" ? (
            <DominiosSection
              busy={busy}
              domains={domains}
              formatDate={formatDate}
              openDomainModal={openDomainModal}
              openEditDomain={openEditDomain}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "auditoria" ? (
            <AuditSection
              busy={busy}
              auditRows={auditRows}
              sedesByCode={sedesByCode}
              formatDate={formatDate}
              reloadAudit={() => {
                void loadAudit();
              }}
            />
          ) : null}
        </section>
      </div>

      <Modal
        open={sedeModalOpen}
        title={editingSedeId ? `Editar sede #${editingSedeId}` : "Gestionar sedes"}
        onClose={closeSedeModal}
        closeDisabled={busy}
        maxWidthClassName="max-w-6xl"
      >
        <SedesManager
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
          clearFieldErrors={(field: "code" | "name") => setFieldErrors((prev) => ({ ...prev, [field]: [] }))}
          submitCreateSede={submitCreateSede}
          submitEditSede={submitEditSede}
          openEditSede={openEditSede}
          deactivateSede={deactivateSede}
          closeSedeModal={closeSedeModal}
        />
      </Modal>

      <Modal
        open={programModalOpen}
        title={programFormId ? `Editar programa #${programFormId}` : "Gestionar programas"}
        onClose={closeProgramModal}
        closeDisabled={busy}
        maxWidthClassName="max-w-6xl"
      >
        <ProgramasManager
          busy={busy}
          programas={programas}
          programFormId={programFormId}
          programFormName={programFormName}
          programFormActive={programFormActive}
          fieldError={fieldError}
          formatDate={formatDate}
          setProgramFormName={setProgramFormName}
          setProgramFormActive={setProgramFormActive}
          resetProgramForm={resetProgramForm}
          closeProgramModal={closeProgramModal}
          openEditProgram={openEditProgram}
          submitProgram={submitProgram}
          toggleProgram={toggleProgram}
          deleteProgram={deleteProgram}
        />
      </Modal>

      <Modal
        open={domainModalOpen}
        title={domainFormId ? `Editar regla de dominio #${domainFormId}` : "Gestionar dominios"}
        onClose={closeDomainModal}
        closeDisabled={busy}
        maxWidthClassName="max-w-7xl"
      >
        <DominiosManager
          busy={busy}
          domains={domains}
          roles={roles}
          sedes={sedes}
          domainFilter={domainFilter}
          domainRoleFilter={domainRoleFilter}
          domainSedeFilter={domainSedeFilter}
          domainStatusFilter={domainStatusFilter}
          domainScopeFilter={domainScopeFilter}
          domainFormId={domainFormId}
          domainFormValue={domainFormValue}
          domainFormScope={domainFormScope}
          domainFormRole={domainFormRole}
          domainFormSede={domainFormSede}
          domainFormActive={domainFormActive}
          fieldError={fieldError}
          formatDate={formatDate}
          setDomainFilter={setDomainFilter}
          setDomainRoleFilter={setDomainRoleFilter}
          setDomainSedeFilter={setDomainSedeFilter}
          setDomainStatusFilter={setDomainStatusFilter}
          setDomainScopeFilter={setDomainScopeFilter}
          setDomainFormValue={setDomainFormValue}
          setDomainFormRole={setDomainFormRole}
          setDomainFormSede={setDomainFormSede}
          setDomainFormActive={setDomainFormActive}
          applyDomainScopeDefaults={applyDomainScopeDefaults}
          resetDomainForm={resetDomainForm}
          submitDomainRule={submitDomainRule}
          openEditDomain={openEditDomain}
          toggleDomainRule={toggleDomainRule}
          deleteDomainRule={deleteDomainRule}
          closeDomainModal={closeDomainModal}
        />
      </Modal>
    </div>
  );
}
