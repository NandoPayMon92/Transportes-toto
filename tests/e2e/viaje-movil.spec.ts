import { expect, test, type Page } from "@playwright/test";

async function ingresar(page: Page, usuario = "demo.logistica") {
  await page.goto("/login");
  await page.getByLabel("Usuario o correo").fill(usuario);
  await page.getByLabel("Contraseña").fill("Demo2026toto");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
}

async function elegir(page: Page, campo: string, texto: string) {
  await page.getByRole("combobox", { name: campo, exact: true }).fill(texto);
  await page.getByRole("option", { name: texto }).first().click();
}

async function completar(page: Page) {
  await elegir(page, "Matrícula", "DMO1002");
  await elegir(page, "Cliente", "Cliente Demo Agro");
  await elegir(page, "Chofer", "Chofer Demo Dos");
  await elegir(page, "Carga", "Maíz");
  await elegir(page, "Lugar de carga", "Salto");
  await elegir(page, "Lugar de descarga", "Nueva Palmira");
  await page.getByLabel("Kg de salida").fill("30.000");
  await page.getByLabel("Kg de llegada").fill("29.900");
}

async function totalViajes(page: Page): Promise<number> {
  const r = await page.request.get("/api/viajes?porPagina=1");
  return (await r.json()).total;
}

test("(12) el formulario de viaje funciona en una pantalla móvil: tarifa automática, cálculo y cierre", async ({ page }) => {
  await ingresar(page);
  await page.getByRole("navigation", { name: "Accesos rápidos" }).getByRole("link", { name: "Nuevo viaje" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo viaje" })).toBeVisible();
  await completar(page);

  // Tarifa de la ruta Salto → Nueva Palmira: 520 por tonelada, base "menor".
  await expect(page.getByText("$ 520,00 por tonelada (1.000 kg)")).toBeVisible();
  await expect(page.getByText("29.950 kg")).toBeVisible(); // promedio
  await expect(page.getByText("$ 15.548,00")).toBeVisible(); // 29.900 kg × 520 / 1000

  // Sin desplazamiento horizontal en móvil.
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Guardar y cerrar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("¿Cerrar el viaje?");
  await dialogo.getByRole("button", { name: "Cerrar viaje" }).click();

  await expect(page.getByText("Viaje guardado correctamente.")).toBeVisible();
  await expect(page.getByText(/Cerrado$/).first()).toBeVisible();
  await expect(page.getByText("$ 15.548,00").first()).toBeVisible();
  await expect(page.getByText("Creó y cerró el viaje")).toBeVisible();
});

test("(13) una doble pulsación en Guardar no crea viajes duplicados", async ({ page }) => {
  await ingresar(page);
  const antes = await totalViajes(page);
  await page.goto("/viajes/nuevo");
  await completar(page);
  await page.getByRole("button", { name: "Guardar viaje" }).dblclick();
  await expect(page.getByText("Viaje guardado correctamente.")).toBeVisible();
  expect(await totalViajes(page)).toBe(antes + 1);
});

test("muestra errores en español al guardar sin datos obligatorios y permite borrador", async ({ page }) => {
  await ingresar(page);
  await page.goto("/viajes/nuevo");
  await page.getByRole("button", { name: "Guardar viaje" }).click();
  await expect(page.getByText(/Para guardar el viaje falta completar/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar como borrador" }).click();
  await expect(page.getByText(/Borrador$/).first()).toBeVisible();
});

test("el rol de consulta no ve el acceso a nuevo viaje ni puede abrir la pantalla", async ({ page }) => {
  await ingresar(page, "demo.consulta");
  await expect(page.getByRole("link", { name: "Nuevo viaje" })).toHaveCount(0);
  await page.goto("/viajes/nuevo");
  await expect(page.getByText("No tiene permiso para acceder a esta sección.")).toBeVisible();
});
