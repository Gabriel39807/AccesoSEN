import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

// Esta suite mockea completamente la API y valida contratos UI/control-flow.
// No debe interpretarse como prueba de integracion real web -> backend.

type MockState = {
  meRole: "superadmin" | "admin_sede" | "aprendiz";
  meUsername?: string;
  controlPanelActive: boolean;
  currentPreset: string;
  tokenRequestBody?: Record<string, unknown>;
  meCalls?: number;
  brandingPatchHeaders?: Record<string, string>;
  brandingPatchBody?: Record<string, unknown>;
};

const TOKENS_BY_PRESET: Record<string, Record<string, string>> = {
  "sadi-blue": {
    color_admin_light: "#2563EB",
    color_admin_dark: "#1D4ED8",
    color_aprendiz_light: "#0EA5E9",
    color_aprendiz_dark: "#0369A1",
    color_guarda_light: "#F59E0B",
    color_guarda_dark: "#B45309",
  },
  "emerald-campus": {
    color_admin_light: "#059669",
    color_admin_dark: "#065F46",
    color_aprendiz_light: "#10B981",
    color_aprendiz_dark: "#047857",
    color_guarda_light: "#F59E0B",
    color_guarda_dark: "#B45309",
  },
};

function paginated<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

function mePayload(state: MockState) {
  return {
    permitido: true,
    motivo: null,
    usuario: {
      id: 1,
      username: state.meUsername || state.meRole,
      rol: state.meRole,
      first_name: "Sadi",
      last_name: "Tester",
      must_change_password: false,
      estado: "activo",
      sede_principal: "norte",
    },
  };
}

function configPayload(state: MockState) {
  return {
    configuracion: {
      nombre_institucion: "SADI QA",
      branding_preset: state.currentPreset,
      ...TOKENS_BY_PRESET[state.currentPreset],
    },
  };
}

function brandingConfigPayload(state: MockState) {
  return {
    configuracion: {
      branding_preset: state.currentPreset,
      branding_preset_name: state.currentPreset === "emerald-campus" ? "Emerald Campus" : "SADI Blue",
      tokens: TOKENS_BY_PRESET[state.currentPreset],
      updated_by: "superadmin",
      updated_at: "2030-01-01T10:00:00Z",
    },
  };
}

async function installApiMocks(page: Page, state: MockState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/configuracion/") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(configPayload(state)) });
    }

    if (path === "/api/token/" && method === "POST") {
      state.tokenRequestBody = (request.postDataJSON() || {}) as Record<string, unknown>;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "test-access", refresh: "test-refresh" }),
      });
    }

    if (path === "/api/me/") {
      state.meCalls = (state.meCalls || 0) + 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mePayload(state)) });
    }

    if (path === "/api/usuarios/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          paginated([
            {
              id: 9,
              username: "aprendiz.demo",
              email: "aprendiz@sadi.local",
              rol: "aprendiz",
              estado: "activo",
              documento: "12345678",
              sede_principal: "norte",
              programa_formacion: "ADSO",
            },
          ]),
        ),
      });
    }

    if (path === "/api/sedes/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          paginated([
            {
              id: 1,
              code: "norte",
              name: "Campus Norte",
              is_active: true,
            },
          ]),
        ),
      });
    }

    if (path === "/api/control-panel/session/status/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          active: state.controlPanelActive,
          session: state.controlPanelActive
            ? {
                id: "cp-session-12345678",
                verified_by: "password",
                expires_at: "2030-01-01T11:00:00Z",
              }
            : null,
        }),
      });
    }

    if (path === "/api/control-panel/session/verify-password/" && method === "POST") {
      const body = (request.postDataJSON() || {}) as { password?: string };
      if (body.password !== "Segura123") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ code: "INVALID_CREDENTIALS", password: ["La contraseña no es correcta."] }),
        });
      }
      state.controlPanelActive = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          active: true,
          session: {
            id: "cp-session-12345678",
            verified_by: "password",
            expires_at: "2030-01-01T11:00:00Z",
          },
        }),
      });
    }

    if (path === "/api/control-panel/branding/presets/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: 1,
              slug: "sadi-blue",
              name: "SADI Blue",
              tokens_json: TOKENS_BY_PRESET["sadi-blue"],
              is_active: true,
              is_default: true,
            },
            {
              id: 2,
              slug: "emerald-campus",
              name: "Emerald Campus",
              tokens_json: TOKENS_BY_PRESET["emerald-campus"],
              is_active: true,
              is_default: false,
            },
          ],
        }),
      });
    }

    if (path === "/api/control-panel/branding/config/" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(brandingConfigPayload(state)),
      });
    }

    if (path === "/api/control-panel/branding/config/" && method === "PATCH") {
      state.brandingPatchHeaders = await request.allHeaders();
      state.brandingPatchBody = (request.postDataJSON() || {}) as Record<string, unknown>;
      state.currentPreset = String(state.brandingPatchBody.branding_preset || state.currentPreset);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(brandingConfigPayload(state)),
      });
    }

    if (path === "/api/control-panel/quotas/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              category: "branding",
              limit: 5,
              used: state.currentPreset === "emerald-campus" ? 2 : 1,
              remaining: state.currentPreset === "emerald-campus" ? 3 : 4,
              window_start: "2030-01-01T00:00:00Z",
              last_action_at: state.currentPreset === "emerald-campus" ? "2030-01-01T10:00:00Z" : null,
            },
          ],
        }),
      });
    }

    if (path === "/api/auditoria/eventos/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: "evt-1",
              type: "control_panel.branding.update",
              timestamp: "2030-01-01T10:00:00Z",
              actor: "superadmin",
              detail: "Cambio de preset de branding",
              sede: null,
            },
          ],
        }),
      });
    }

    if (path === "/api/roles/" || path === "/api/permisos/" || path === "/api/asignaciones/" || path === "/api/dominios-email/") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paginated([])) });
    }

    if (path.startsWith("/api/") && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(paginated([])) });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

test("admin web login submits expected auth payload", async ({ page }) => {
  const state: MockState = {
    meRole: "superadmin",
    meUsername: "superadmin",
    controlPanelActive: false,
    currentPreset: "sadi-blue",
  };
  await installApiMocks(page, state);

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const usernameInput = page.getByRole("textbox", { name: "Usuario o correo" });
  const passwordInput = page.getByRole("textbox", { name: "Contraseña" });
  await expect(usernameInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await usernameInput.fill("superadmin");
  await passwordInput.fill("Segura123");
  await expect(usernameInput).toHaveValue("superadmin");
  await page.getByRole("button", { name: "Entrar al sistema" }).click();
  await expect.poll(() => state.tokenRequestBody, { timeout: 10_000 }).not.toBeUndefined();
  expect(state.tokenRequestBody).toMatchObject({
    username: "superadmin",
    password: "Segura123",
    expected_role: "admin",
    auth_transport: "cookie",
  });
  await expect.poll(() => state.meCalls || 0, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("superadmin reauthenticates with password and applies branding preset with control headers", async ({ page }) => {
  const state: MockState = {
    meRole: "superadmin",
    meUsername: "superadmin",
    controlPanelActive: false,
    currentPreset: "sadi-blue",
  };
  await installApiMocks(page, state);

  await page.goto("/admin/control-center", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Superadmin / Centro de control" })).toBeVisible();
  await expect(page.getByText("Cerrada")).toBeVisible();
  await expect(page.getByText("Reautenticacion con clave")).toBeVisible();
  await expect(page.getByText(/valida la clave actual del usuario autenticado/i)).toBeVisible();
  await expect(page.getByText(/sesión reforzada requerida/i)).toBeVisible();
  await expect(page.getByPlaceholder("Ej: Activar identidad visual del cliente para campus norte")).toBeDisabled();

  await page.getByPlaceholder("Vuelve a poner tu clave").first().fill("Segura123");
  await page.getByRole("button", { name: "Abrir sesión reforzada" }).click();

  await expect(page.getByText("Activa", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sesión:\s+cp-sessi/i)).toBeVisible();
  await expect(page.getByPlaceholder("Ej: Activar identidad visual del cliente para campus norte")).toBeEnabled();

  await page
    .getByPlaceholder("Ej: Activar identidad visual del cliente para campus norte")
    .fill("Aplicar preset verde para el cliente piloto");

  const emeraldCard = page.locator("article").filter({ hasText: "Emerald Campus" });
  await emeraldCard.getByRole("button", { name: "Aplicar preset" }).click();

  await expect(page.getByText("Emerald Campus (emerald-campus)")).toBeVisible();
  expect(state.brandingPatchBody).toEqual({ branding_preset: "emerald-campus" });
  expect(state.brandingPatchHeaders?.["x-control-panel-session"]).toBe("cp-session-12345678");
  expect(state.brandingPatchHeaders?.["x-control-panel-reason"]).toBe("Aplicar preset verde para el cliente piloto");
});

test("control center blocks branding mutation without explicit reason", async ({ page }) => {
  const state: MockState = {
    meRole: "superadmin",
    meUsername: "superadmin",
    controlPanelActive: true,
    currentPreset: "sadi-blue",
  };
  await installApiMocks(page, state);

  await page.goto("/admin/control-center", { waitUntil: "domcontentloaded" });

  const emeraldCard = page.locator("article").filter({ hasText: "Emerald Campus" });
  await emeraldCard.getByRole("button", { name: "Aplicar preset" }).click();

  await expect(page.getByText("Debes indicar un motivo del cambio antes de modificar el panel.")).toBeVisible();
  expect(state.brandingPatchBody).toBeUndefined();
});
