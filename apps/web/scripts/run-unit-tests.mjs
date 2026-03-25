import assert from "node:assert/strict";
import { read as readWorkbook, utils as xlsxUtils } from "xlsx";
import { buildControlPanelHeaders, buildDomainRulePayload, normalizeDomainValue, validateControlPanelReason } from "../src/lib/control-center.ts";
import { COOKIE_AUTH_MODE } from "../src/lib/api-config.ts";
import {
  APRENDIZ_IMPORT_FORMATS,
  APRENDIZ_IMPORT_JORNADAS,
  APRENDIZ_IMPORT_MAX_FILE_SIZE_BYTES,
  buildAprendizImportFormData,
  buildAprendizImportTemplateCsv,
  buildAprendizImportTemplateFilename,
  buildAprendizImportTemplateWorkbook,
  buildUserListParams,
  buildUserMutationPayload,
  canManageRole,
  formatFileSize,
  getAprendizImportTemplateColumns,
  getVisibleRoleFilters,
  getVisibleRoleOptions,
  isAdministrativeRole,
  validateAprendizImportFile,
} from "../src/lib/admin-users.ts";
import { AUTH_WEB_FLOW, clearTokens, getAccessToken, saveTokens } from "../src/lib/auth.ts";
import { buildPasswordRecoveryUrl, PASSWORD_RECOVERY_ROUTE, PASSWORD_RECOVERY_SUCCESS_ROUTE } from "../src/lib/password-recovery-routes.ts";
import { resolveRouteAccess } from "../src/lib/route-access.ts";

const tests = [
  {
    name: "admin user helpers allow superadmin to create admin_sede",
    run() {
      assert.equal(canManageRole("superadmin", "admin_sede"), true);
      assert.deepEqual(getVisibleRoleOptions("superadmin"), ["superadmin", "admin_sede", "guarda", "aprendiz"]);
    },
  },
  {
    name: "admin user helpers block admin_sede from administrative roles",
    run() {
      assert.equal(canManageRole("admin_sede", "admin_sede"), false);
      assert.equal(canManageRole("admin_sede", "superadmin"), false);
      assert.deepEqual(getVisibleRoleOptions("admin_sede"), ["guarda", "aprendiz"]);
    },
  },
  {
    name: "admin user helpers lock admin_sede payloads to own sede",
    run() {
      assert.deepEqual(
        buildUserMutationPayload({
          actorRole: "admin_sede",
          actorSede: "sede-norte",
          role: "guarda",
          estado: "activo",
          sede_principal: "sede-sur",
          email: "guarda@sadi.test",
        }),
        {
          rol: "guarda",
          estado: "activo",
          email: "guarda@sadi.test",
          sede_principal: "sede-norte",
          programa_formacion: undefined,
          documento: undefined,
        },
      );
    },
  },
  {
    name: "admin user helpers build admin_sede filter params with technical values",
    run() {
      assert.deepEqual(
        buildUserListParams({
          actorRole: "superadmin",
          actorSede: null,
          query: "  maria  ",
          roleFilter: "admin_sede",
          stateFilter: "bloqueado",
          sedeFilter: "sede-centro",
          page: 2,
          pageSize: 25,
        }),
        {
          page: 2,
          page_size: 25,
          q: "maria",
          rol: "admin_sede",
          estado: "bloqueado",
          sede_principal: "sede-centro",
        },
      );
    },
  },
  {
    name: "admin user helpers force admin_sede filters to own sede",
    run() {
      assert.deepEqual(
        buildUserListParams({
          actorRole: "admin_sede",
          actorSede: "sede-1",
          query: "",
          roleFilter: "guarda",
          stateFilter: "activo",
          sedeFilter: "sede-2",
          page: 1,
          pageSize: 10,
        }),
        {
          page: 1,
          page_size: 10,
          rol: "guarda",
          estado: "activo",
          sede_principal: "sede-1",
        },
      );
    },
  },
  {
    name: "admin user helpers expose only valid role filters",
    run() {
      assert.deepEqual(getVisibleRoleFilters("superadmin"), ["superadmin", "admin_sede", "guarda", "aprendiz"]);
      assert.deepEqual(getVisibleRoleFilters("admin_sede"), ["guarda", "aprendiz"]);
    },
  },
  {
    name: "admin stats helper excludes legacy admin aliases",
    run() {
      assert.equal(isAdministrativeRole("admin"), false);
      assert.equal(isAdministrativeRole("admin_sede"), true);
      assert.equal(isAdministrativeRole("superadmin"), true);
    },
  },
  {
    name: "aprendiz import template omits sede for admin_sede",
    run() {
      assert.deepEqual(getAprendizImportTemplateColumns("admin_sede"), [
        "Nombres",
        "Apellidos",
        "Documento",
        "Telefono",
        "Correo",
        "Jornada",
        "Programa",
      ]);
      const csv = buildAprendizImportTemplateCsv({ actorRole: "admin_sede" });
      assert.match(csv, /^\uFEFFNombres,Apellidos,Documento,Telefono,Correo,Jornada,Programa\r?\n$/u);
      const workbook = readWorkbook(buildAprendizImportTemplateWorkbook({ actorRole: "admin_sede" }), { type: "array" });
      assert.equal(workbook.SheetNames[0], "Aprendices");
      assert.deepEqual(xlsxUtils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }), [[
        "Nombres",
        "Apellidos",
        "Documento",
        "Telefono",
        "Correo",
        "Jornada",
        "Programa",
      ]]);
      assert.equal(buildAprendizImportTemplateFilename("admin_sede", "xlsx"), "plantilla-importacion-aprendices-admin-sede.xlsx");
    },
  },
  {
    name: "aprendiz import template includes sede for superadmin with supported technical values",
    run() {
      assert.deepEqual(APRENDIZ_IMPORT_FORMATS, [".csv", ".xlsx", ".xlsm", ".xltx", ".xltm"]);
      assert.deepEqual(APRENDIZ_IMPORT_JORNADAS, ["MAÑANA", "TARDE", "NOCHE"]);
      assert.deepEqual(getAprendizImportTemplateColumns("superadmin"), [
        "Nombres",
        "Apellidos",
        "Documento",
        "Telefono",
        "Correo",
        "Jornada",
        "Programa",
        "Sede",
      ]);
      const csv = buildAprendizImportTemplateCsv({ actorRole: "superadmin" });
      assert.match(csv, /^\uFEFFNombres,Apellidos,Documento,Telefono,Correo,Jornada,Programa,Sede\r?\n$/u);
      const workbook = readWorkbook(buildAprendizImportTemplateWorkbook({ actorRole: "superadmin" }), { type: "array" });
      assert.deepEqual(xlsxUtils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }), [[
        "Nombres",
        "Apellidos",
        "Documento",
        "Telefono",
        "Correo",
        "Jornada",
        "Programa",
        "Sede",
      ]]);
      assert.equal(buildAprendizImportTemplateFilename("superadmin", "csv"), "plantilla-importacion-aprendices-superadmin.csv");
    },
  },
  {
    name: "aprendiz import file validation rejects invalid files before upload",
    run() {
      assert.equal(validateAprendizImportFile({ name: "aprendices.txt", size: 10 }), "Formato no soportado. Usa .CSV, .XLSX, .XLSM, .XLTX, .XLTM.");
      assert.equal(validateAprendizImportFile({ name: "aprendices.csv", size: 0 }), "El archivo esta vacio. Descarga la plantilla y completa al menos una fila.");
      assert.equal(
        validateAprendizImportFile({ name: "aprendices.xlsx", size: APRENDIZ_IMPORT_MAX_FILE_SIZE_BYTES + 1 }),
        "El archivo supera el maximo de 5.0 MB.",
      );
      assert.equal(validateAprendizImportFile({ name: "aprendices.xlsx", size: 1024 }), null);
    },
  },
  {
    name: "aprendiz import upload builds form-data payload with browser-managed content type",
    run() {
      const file = new Blob(["Nombres,Apellidos\nAna,Importa\n"], { type: "text/csv" });
      const form = buildAprendizImportFormData(file, "aprendices.csv");
      const uploaded = form.get("file");
      assert.ok(uploaded instanceof File);
      assert.equal(uploaded.name, "aprendices.csv");
      assert.equal(uploaded.type, "text/csv");
    },
  },
  {
    name: "aprendiz import file helper formats byte sizes for ui copy",
    run() {
      assert.equal(formatFileSize(512), "512 B");
      assert.equal(formatFileSize(2048), "2.0 KB");
      assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
    },
  },
  {
    name: "route-access redirects authenticated admins away from login",
    run() {
      assert.deepEqual(resolveRouteAccess("/login", "superadmin"), {
        kind: "redirect",
        destination: "/admin/inicio",
      });
    },
  },
  {
    name: "route-access redirects aprendiz away from login",
    run() {
      assert.deepEqual(resolveRouteAccess("/login", "aprendiz"), {
        kind: "redirect",
        destination: "/aprendiz/inicio",
      });
    },
  },
  {
    name: "route-access blocks admin_sede from control center",
    run() {
      assert.deepEqual(resolveRouteAccess("/admin/control-center", "admin_sede"), {
        kind: "redirect",
        destination: "/admin/inicio",
      });
    },
  },
  {
    name: "route-access blocks aprendiz users from admin routes",
    run() {
      assert.deepEqual(resolveRouteAccess("/admin/usuarios", "aprendiz"), {
        kind: "redirect",
        destination: "/aprendiz/inicio",
      });
    },
  },
  {
    name: "route-access blocks admin users from aprendiz routes",
    run() {
      assert.deepEqual(resolveRouteAccess("/aprendiz/perfil", "admin_sede"), {
        kind: "redirect",
        destination: "/admin/inicio",
      });
    },
  },
  {
    name: "control-center headers omit empty values",
    run() {
      assert.deepEqual(buildControlPanelHeaders("", "   "), {});
    },
  },
  {
    name: "control-center headers include session and reason",
    run() {
      assert.deepEqual(buildControlPanelHeaders("cp-session-1", "Aplicar preset"), {
        "X-Control-Panel-Session": "cp-session-1",
        "X-Control-Panel-Reason": "Aplicar preset",
      });
    },
  },
  {
    name: "control-center reason validation rejects empty reason",
    run() {
      assert.equal(validateControlPanelReason(""), "Debes indicar un motivo del cambio antes de modificar el panel.");
      assert.equal(validateControlPanelReason("Ajuste operativo"), null);
    },
  },
  {
    name: "control-center normalizes domains",
    run() {
      assert.equal(normalizeDomainValue("  @Empresa.COM "), "empresa.com");
    },
  },
  {
    name: "control-center domain payload validates role requirement",
    run() {
      assert.deepEqual(
        buildDomainRulePayload({
          domain: "empresa.com",
          scope: "ROLE",
          role: "",
          sede: "",
          isActive: true,
        }),
        { ok: false, error: "Selecciona un rol para el alcance elegido." },
      );
    },
  },
  {
    name: "control-center domain payload builds role+sede payload",
    run() {
      assert.deepEqual(
        buildDomainRulePayload({
          domain: "@Empresa.COM",
          scope: "ROLE_SEDE",
          role: "admin_sede",
          sede: "norte",
          isActive: true,
        }),
        {
          ok: true,
          payload: {
            domain: "empresa.com",
            is_active: true,
            role: "admin_sede",
            sede: "norte",
          },
        },
      );
    },
  },
  {
    name: "password-recovery route builder returns base route without params",
    run() {
      assert.equal(buildPasswordRecoveryUrl(), PASSWORD_RECOVERY_ROUTE);
    },
  },
  {
    name: "password-recovery route builder serializes reset params",
    run() {
      assert.equal(
        buildPasswordRecoveryUrl("reset", { email: "user@example.com", otp: "123456" }),
        "/password-recovery?step=reset&email=user%40example.com&otp=123456",
      );
    },
  },
  {
    name: "password-recovery success alias points to canonical success route",
    run() {
      assert.equal(PASSWORD_RECOVERY_SUCCESS_ROUTE, "/auth/success");
    },
  },
  {
    name: "web auth flow is cookie-only for refresh",
    run() {
      assert.equal(COOKIE_AUTH_MODE, true);
      assert.equal(AUTH_WEB_FLOW, "access-memory-plus-refresh-cookie");
    },
  },
  {
    name: "web auth access token stays in memory only",
    run() {
      clearTokens();
      saveTokens({ access: "access-only", refresh: "refresh-cookie" });
      assert.equal(getAccessToken(), "access-only");
      clearTokens();
      assert.equal(getAccessToken(), null);
    },
  },
];

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`PASS ${tests.length} tests`);
}
