"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import {
  BrandingSection,
  ControlPanelAccessCard,
  PermissionsSection,
  ProgramasSection,
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

  async function loadPrograms() {
    const response = await api.get<ProgramRow[] | Paginated<ProgramRow>>("/api/programas-formacion/", {
      params: { include_inactive: "true" },
      headers: controlPanelHeaders(),
    });
    setProgramas(toRows(response.data));
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
        await Promise.all([loadBranding(), loadRoles(), loadPermissions(), loadAssignments(), loadDomains(), loadPrograms(), loadAudit()]);
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
      setControlPanelSession({
        active: Boolean(verifyResponse.data?.active),
        session: verifyResponse.data?.session ?? null,
      });
      setReauthPassword("");
      await loadControlCenter();
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

  function resetProgramForm() {
    setProgramFormId(null);
    setProgramFormName("");
    setProgramFormActive(true);
  }

  function openEditProgram(row: ProgramRow) {
    clearErrors();
    setProgramFormId(row.id);
    setProgramFormName(row.name);
    setProgramFormActive(row.is_active);
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
                    <h2 className="text-lg font-semibold text-text">Confirma tu clave para continuar</h2>
                    <p className="mt-1 max-w-2xl text-sm text-text/75">
                      La vista de {secureSessionRequiredLabels[activeSection]} queda protegida para la demo. El flujo OTP del panel ya se retiró de esta interfaz y ahora pedimos volver a ingresar la clave del usuario autenticado para abrir la sesión reforzada.
                    </p>
                  </div>
                </div>
                <div className="w-full max-w-sm space-y-3">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={reauthPassword}
                    onChange={(event) => updateReauthPassword(event.target.value)}
                    placeholder="Vuelve a poner tu clave"
                    className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm"
                  />
                  {fieldError("password") ? <p className="text-xs text-rose-600">{fieldError("password")}</p> : null}
                  <button
                    type="button"
                    onClick={openControlPanelWithPassword}
                    disabled={busy || !reauthPassword.trim()}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy ? "Verificando..." : "Abrir sesión reforzada"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-text/70">
                Esta reautenticacion valida la clave del usuario autenticado antes de abrir la sesion reforzada del panel. No reactiva OTP ni depende de passkeys para la demo.
              </p>
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

          {controlPanelSession.active && activeSection === "programas" ? (
            <ProgramasSection
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
              openEditProgram={openEditProgram}
              submitProgram={submitProgram}
              toggleProgram={toggleProgram}
              deleteProgram={deleteProgram}
            />
          ) : null}

          {controlPanelSession.active && activeSection === "roles" ? (
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

          {controlPanelSession.active && activeSection === "permisos" ? (
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

          {controlPanelSession.active && activeSection === "asignaciones" ? (
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

          {controlPanelSession.active && activeSection === "dominios" ? (
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

          {controlPanelSession.active && activeSection === "auditoria" ? (
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
