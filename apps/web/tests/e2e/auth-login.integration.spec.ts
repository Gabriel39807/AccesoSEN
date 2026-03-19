import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("real web login reaches admin usuarios with local backend", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const usernameInput = page.getByRole("textbox", { name: "Usuario o correo" });
  const passwordInput = page.getByRole("textbox", { name: "Contraseña" });

  await expect(usernameInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await usernameInput.fill("smoke_admin");
  await expect(usernameInput).toHaveValue("smoke_admin");

  await passwordInput.fill("SmokePassw0rd!");
  await expect(passwordInput).toHaveValue("SmokePassw0rd!");

  await page.getByRole("button", { name: "Entrar al sistema" }).click();

  await page.waitForURL("**/admin/usuarios", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
  await expect(page.getByText("smoke_aprendiz")).toBeVisible();
});
