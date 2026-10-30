/**
 * Comprobación visual: renderiza la app a tamaño iPhone y guarda capturas.
 * Uso: node scripts/shot.mjs [pestaña]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.APP_URL ?? "http://localhost:5199/";
const OUT = "/tmp/carbolab-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
await page.goto(URL, { waitUntil: "networkidle" });

// Rellenamos el campo para ver el resultado y forzar contenido largo.
await page.locator("#hc100").fill("91");
await page.screenshot({ path: `${OUT}/bebidas.png` });

// Scroll al final para comprobar que los botones quedan accesibles.
await page.evaluate(() => {
  const m = document.querySelector(".app-main");
  if (m) m.scrollTop = m.scrollHeight;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/bebidas-scroll-fin.png` });

await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/alimentos.png` });

// Con el formulario abierto desde la opción "+ Crear alimento nuevo…".
await page.locator(".ingredient-row select").first().selectOption("+ Crear alimento nuevo…");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/alimentos-form.png`, fullPage: false });

await page.locator(".tab-bar-btn", { hasText: "Entreno" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/entreno.png` });

await browser.close();
console.log("Capturas guardadas en", OUT);
