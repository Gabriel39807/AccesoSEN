"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { normalizeApiErrors } from "@/lib/errors";
import { useMe } from "@/hooks/useMe";

type SectionKey = "sedes" | "roles" | "permisos" | "asignaciones" | "auditoria";

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

type AuditRow = {
  id: string;
  type: string;
  timestamp: string | null;
  actor: string | null;
  detail: string;
  sede: string | null;
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
  { key: "sedes", label: "Sedes" },
  { key: "roles", label: "Roles" },
  { key: "permisos", label: "Permisos" },
  { key: "asignaciones", label: "Asignaciones" },
  { key: "auditoria", label: "Auditoria" },
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
  const [activeSection, setActiveSection] = useState<SectionKey>("sedes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [sedes, setSedes] = useState<SedeRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

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

  function notifySedesUpdated() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sedes:updated"));
    }
  }

  async function loadSedes() {
    const response = await api.get<SedeRow[] | Paginated<SedeRow>>("/api/sedes/", {
      params: { include_inactive: "true" },
    });
    setSedes(toRows(response.data));
  }

  async function loadRoles() {
    const response = await api.get<RoleRow[] | Paginated<RoleRow>>("/api/roles/");
    setRoles(toRows(response.data));
  }

  async function loadPermissions() {
    const response = await api.get<PermissionRow[] | Paginated<PermissionRow>>("/api/permisos/");
    setPermissions(toRows(response.data));
  }

  async function loadAssignments() {
    const response = await api.get<AssignmentRow[] | Paginated<AssignmentRow>>("/api/asignaciones/");
    setAssignments(toRows(response.data));
  }

  async function loadAudit() {
    const response = await api.get<AuditResponse>("/api/auditoria/eventos/");
    setAuditRows(response.data?.results ?? []);
  }

  async function loadControlCenter() {
    setLoading(true);
    clearErrors();
    try {
      await Promise.all([loadSedes(), loadRoles(), loadPermissions(), loadAssignments(), loadAudit()]);
    } catch (error) {
      setApiErrors(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadingMe) return;
    if (me?.rol !== "superadmin") return;
    loadControlCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMe, me?.rol]);

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

  async function submitCreateSede() {
    clearErrors();
    if (!createSedeCode.trim() || !createSedeName.trim()) {
      setFormErrors(["Debes completar codigo y nombre de sede."]);
      return;
    }

    setBusy(true);
    try {
      await api.post("/api/sedes/", {
        code: createSedeCode.trim().toLowerCase(),
        name: createSedeName.trim(),
        is_active: true,
      });
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
    setBusy(true);
    try {
      await api.patch(`/api/sedes/${editingSedeId}/`, {
        code: editingSedeCode.trim().toLowerCase(),
        name: editingSedeName.trim(),
        is_active: editingSedeActive,
      });
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
    setBusy(true);
    try {
      await api.delete(`/api/sedes/${row.id}/`);
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
    setBusy(true);
    try {
      await api.post("/api/roles/", {
        code: roleCode.trim().toLowerCase(),
        name: roleName.trim(),
        is_system: false,
      });
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
    setBusy(true);
    try {
      await api.post("/api/permisos/", {
        code: permissionCode.trim().toLowerCase(),
        name: permissionName.trim(),
        description: permissionDescription.trim(),
      });
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
    setBusy(true);
    try {
      await api.post("/api/asignaciones/", {
        role: assignmentRole,
        permission: assignmentPermission,
        scope: assignmentScope,
      });
      await loadAssignments();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(row: AssignmentRow) {
    clearErrors();
    setBusy(true);
    try {
      await api.delete(`/api/asignaciones/${row.id}/`);
      await loadAssignments();
    } catch (error) {
      setApiErrors(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <h1 className="text-2xl font-bold text-primary">Superadmin / Control Center</h1>
        <p className="text-sm text-text/70">
          Gestion centralizada de sedes, RBAC y visibilidad de auditoria.
        </p>
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
          {activeSection === "sedes" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-text/70">Codigo de sede</label>
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
                      <th className="px-3 py-2">Codigo</th>
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
                      placeholder="codigo"
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
                  placeholder="codigo del rol"
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
                      <th className="px-3 py-2">Codigo</th>
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
                  placeholder="codigo del permiso"
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
                placeholder="descripcion (opcional)"
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
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Descripcion</th>
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

          {activeSection === "auditoria" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={loadAudit}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm font-semibold hover:bg-primary/10"
              >
                Recargar auditoria
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
