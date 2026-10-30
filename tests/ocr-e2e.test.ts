/**
 * OCR de extremo a extremo: sube una etiqueta NUTRICIONAL REAL como imagen y
 * comprueba que la app rellena los campos con las cifras correctas.
 *
 * Requiere el dev server (npm run dev) porque usa Tesseract.js desde la CDN.
 */
import { afterAll, beforeAll, describe, expect as vExpect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { expect } from "@playwright/test";
import { startAppServer, etiquetaDisponible } from "./helpers/server";

const ETIQUETA = "/tmp/carbolab-etiqueta.png";
const IPHONE = { width: 393, height: 852 };

let browser: Browser;
let page: Page;
let URL = "";

beforeAll(async () => {
  const server = await startAppServer();
  URL = server.url;

  browser = await chromium.launch();
  page = await browser.newPage({ viewport: IPHONE });
  await page.goto(URL, { waitUntil: "networkidle" });
}, 90_000);

afterAll(async () => {
  await browser?.close();
});

/**
 * Sube el archivo por el input oculto y espera a que el OCR termine,
 * leyendo lo que la app ha metido en los campos.
 *
 * Vaciamos los campos ANTES de subir la imagen: si no, el test vería el valor
 * del test anterior y daría por bueno un OCR que en realidad no ha corrido.
 */
async function leerEtiqueta(page: Page): Promise<{ hc: string; sodio: string }> {
  await page.locator("#hc100").fill("");
  await page.locator("#sodio100").fill("");

  await page.setInputFiles('input[type="file"][capture]', ETIQUETA);

  // El campo #hc100 se rellena cuando termina el análisis.
  await expect
    .poll(
      async () => (await page.locator("#hc100").inputValue()) || "vacio",
      { timeout: 120_000, message: "El OCR no rellenó el campo HC a tiempo" }
    )
    .not.toBe("vacio");

  return {
    hc: await page.locator("#hc100").inputValue(),
    sodio: await page.locator("#sodio100").inputValue(),
  };
}

// El OCR descarga el paquete de idioma de la CDN la primera vez, así que
// estos tests necesitan bastante más margen que los de UI.
const TIMEOUT_OCR = 180_000;

describe.skipIf(!etiquetaDisponible())("OCR sobre etiqueta real", () => {
  it(
    "lee 91 g de HC (no 99 ni 88)",
    async () => {
      await page.locator(".tab-bar-btn", { hasText: "Bebidas" }).click();
      const { hc } = await leerEtiqueta(page);
      vExpect(hc).toBe("91");
    },
    TIMEOUT_OCR
  );

  it(
    "lee el sodio en mg y calcula el producto",
    async () => {
      const { sodio } = await leerEtiqueta(page);
      vExpect(sodio).toBe("250");

      // 500 ml isotónica = 35 g HC; producto 91 g HC/100g → 38,5 g.
      const readout = page.locator(".readout-value").first();
      await expect(readout).toBeVisible();
      await expect(readout).toContainText("38.5");
    },
    TIMEOUT_OCR
  );

  it(
    "el resultado no confunde HC con las calorías",
    async () => {
      // "400 kcal" está en la misma tabla: si el parser cogiera esa fila,
      // el resultado sería ~8,75 g en vez de 38,5 g.
      const readout = page.locator(".readout-value").first();
      await expect(readout).toContainText("38.5");
      const texto = (await readout.textContent()) ?? "";
      vExpect(texto).not.toContain("8.8");
    },
    TIMEOUT_OCR
  );

  it(
    "el texto del azúcar (88 g) no gana al de HC (91 g)",
    async () => {
      const { hc } = await leerEtiqueta(page);
      vExpect(hc).toBe("91");
    },
    TIMEOUT_OCR
  );
});
