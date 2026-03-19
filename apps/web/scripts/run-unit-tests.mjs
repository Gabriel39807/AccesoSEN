import assert from "node:assert/strict";
import { buildControlPanelHeaders, buildDomainRulePayload, normalizeDomainValue, validateControlPanelReason } from "../src/lib/control-center.ts";
import { COOKIE_AUTH_MODE } from "../src/lib/api-config.ts";
import { AUTH_WEB_FLOW, clearTokens, getAccessToken, saveTokens } from "../src/lib/auth.ts";
import { buildPasswordRecoveryUrl, PASSWORD_RECOVERY_ROUTE, PASSWORD_RECOVERY_SUCCESS_ROUTE } from "../src/lib/password-recovery-routes.ts";
import { resolveRouteAccess } from "../src/lib/route-access.ts";

const tests = [
  {
    name: "route-access redirects authenticated admins away from login",
    run() {
      assert.deepEqual(resolveRouteAccess("/login", "superadmin"), {
        kind: "redirect",
        destination: "/admin/usuarios",
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
