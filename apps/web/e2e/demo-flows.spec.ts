import { expect, test, type Page } from "@playwright/test";

type Equipo = {
  id: number;
  serial: string;
  marca: string;
  modelo: string;
  estado: "pendiente" | "aprobado" | "rechazado";
};

function seedAuthTokens(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem("sadi_access", "demo-access");
    window.localStorage.setItem("sadi_refresh", "demo-refresh");
  });
}

async function mockAprendizApi(page: Page, initialEquipos: Equipo[] = []) {
  const equipos = [...initialEquipos];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === "/api/token/" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "demo-access", refresh: "demo-refresh" }),
      });
      return;
    }

    if (pathname === "/api/me/" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          permitido: true,
          motivo: null,
          usuario: {
            id: 99,
            username: "aprendiz.demo",
            rol: "aprendiz",
            first_name: "Demo",
            last_name: "User",
            documento: "10203040",
            must_change_password: false,
            programa_formacion: "ADSO",
            sede_principal: "Centro Principal",
          },
        }),
      });
      return;
    }

    if (pathname === "/api/accesos/estado/" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          estado: "FUERA",
          ultimo_tipo: "salida",
          ultima_fecha: "2026-03-18T12:10:00Z",
        }),
      });
      return;
    }

    if (pathname === "/api/accesos/mis_accesos/" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 500,
            tipo: "ingreso",
            fecha: "2026-03-18T10:20:00Z",
            sede: "Centro Principal",
            equipos: equipos.map((eq) => eq.id),
          },
        ]),
      });
      return;
    }

    if (pathname === "/api/equipos/" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(equipos),
      });
      return;
    }

    if (pathname === "/api/equipos/" && request.method() === "POST") {
      const payload = request.postDataJSON() as { serial: string; marca: string; modelo: string };
      const nuevo = {
        id: 1000 + equipos.length,
        serial: payload.serial,
        marca: payload.marca,
        modelo: payload.modelo,
        estado: "pendiente" as const,
      };
      equipos.unshift(nuevo);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(nuevo),
      });
      return;
    }

    if (pathname === "/api/aprendiz/mi-qr/" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          permitido: true,
          motivo: null,
          qr_value: "signed-token",
          documento: "10203040",
          algoritmo: "HMAC-SHA256",
          qr_png_base64:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: `Mock no configurado para ${pathname}` }),
    });
  });
}

test.describe("Demo E2E SADI (flujos de exposicion)", () => {
  test("1) Login principal de aprendiz redirige al panel", async ({ page }) => {
    await mockAprendizApi(page);

    await page.goto("/login");
    await page.getByRole("button", { name: "Aprendiz" }).click();
    await page.getByLabel("Documento de identidad").fill("10203040");
    await page.getByLabel("contrasena").fill("Demo12345");
    await page.getByRole("button", { name: "Iniciar sesion" }).click();

    await expect(page).toHaveURL(/\/aprendiz\/inicio$/);
    await expect(page.getByText("Resumen de hoy")).toBeVisible();
  });

  test("2) Validacion de formulario: equipo nuevo requiere campos obligatorios", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAprendizApi(page);

    await page.goto("/aprendiz/equipos/nuevo");
    await page.getByRole("button", { name: "Registrar equipo" }).click();

    await expect(page.getByText("Completa serial, marca y modelo.")).toBeVisible();
  });

  test("3) Navegacion critica: del panel a Mi QR", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAprendizApi(page);

    await page.goto("/aprendiz/inicio");
    await page.getByRole("link", { name: "Mi QR" }).first().click();

    await expect(page).toHaveURL(/\/aprendiz\/mi-qr$/);
    await expect(page.getByRole("heading", { name: "Mi QR de acceso" })).toBeVisible();
    await expect(page.getByAltText("Mi QR SADI")).toBeVisible();
  });

  test("4) Accion principal: registrar equipo y volver al listado", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAprendizApi(page, [
      { id: 1, serial: "INIT-001", marca: "Lenovo", modelo: "ThinkPad", estado: "aprobado" },
    ]);

    await page.goto("/aprendiz/equipos/nuevo");
    await page.getByPlaceholder("Ej: ABC1234").fill("ABC1234");
    await page.getByPlaceholder("Ej: HP, Lenovo, Dell").fill("Dell");
    await page.getByPlaceholder("Ej: Pavilion 15").fill("Latitude 5400");
    await page.getByRole("button", { name: "Registrar equipo" }).click();

    await expect(page.getByText(/Equipo registrado\./)).toBeVisible();
    await expect(page).toHaveURL(/\/aprendiz\/equipos$/);
    await expect(page.getByText("Dell Latitude 5400")).toBeVisible();
  });
});
