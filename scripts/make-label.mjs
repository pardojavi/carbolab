/**
 * Genera una etiqueta nutricional sintética como PNG para probar el OCR
 * de extremo a extremo contra una imagen real (no solo texto).
 *
 * Uso: node scripts/make-label.mjs [salida.png]
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "/tmp/carbolab-etiqueta.png";

const filas = [
  ["INFORMACIÓN NUTRICIONAL", "", true],
  ["por 100 g", "", false],
  ["Valor energético", "400 kcal", false],
  ["Proteínas", "6 g", false],
  ["Hidratos de carbono", "91 g", false],
  ["de los cuales azúcares", "88 g", false],
  ["Grasas", "1,2 g", false],
  ["Sodio", "250 mg", false],
];

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
  .label { width:620px; padding:40px; }
  .row { display:flex; justify-content:space-between; font-size:30px; padding:8px 0; }
  .row.head { font-weight:700; }
</style></head><body>
<div class="label">
${filas
  .map(
    ([n, v, b]) =>
      `<div class="row${b ? " head" : ""}"><span>${n}</span><span>${v}</span></div>`
  )
  .join("\n")}
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
await page.setContent(html);
const el = await page.locator(".label");
const buf = await el.screenshot();
writeFileSync(out, buf);
await browser.close();
console.log("Etiqueta escrita en", out);
