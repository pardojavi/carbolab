/**
 * Verifica la BUILD DE PRODUCCIÓN (dist/), no el servidor de desarrollo.
 * Sirve dist/ con un servidor estático y comprueba que la app funciona:
 * cálculo, navegación, scroll y que no hay errores de consola.
 *
 * Uso: node scripts/verify-dist.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const RAIZ = new URL("../dist/", import.meta.url).pathname;
const PUERTO = 4321;

if (!existsSync(RAIZ)) {
  console.error("No existe dist/. Ejecuta primero: npm run build");
  process.exit(1);
}

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (ruta === "/") ruta = "/index.html";
    // Impedimos salir de dist/ con ..
    const abs = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
    const info = await stat(abs);
    const destino = info.isDirectory() ? join(abs, "index.html") : abs;
    const datos = await readFile(destino);
    res.writeHead(200, { "content-type": TIPOS[extname(destino)] ?? "application/octet-stream" });
    res.end(datos);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(PUERTO, r));
const URL_BASE = `http://localhost:${PUERTO}/`;
console.log(`Sirviendo dist/ en ${URL_BASE}\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

const errores = [];
page.on("console", (m) => {
  if (m.type() === "error") errores.push(m.text());
});
page.on("pageerror", (e) => errores.push(String(e)));

let fallos = 0;
function check(nombre, ok, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLO"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

await page.goto(URL_BASE, { waitUntil: "networkidle" });
check("la app carga", (await page.locator(".app-header-logo").textContent()) === "CARBOLAB");

// 1. Los botones de foto/galería son alcanzables (el bug que reportaste).
for (const texto of ["Hacer foto", "Galería"]) {
  const btn = page.locator("button", { hasText: texto }).first();
  await btn.scrollIntoViewIfNeeded();
  const info = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes(t)
    );
    if (!el) return null;
    el.scrollIntoView();
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      visible: r.top >= 0 && r.bottom <= window.innerHeight,
      tapado: top === null || `${top.className}`.includes("tab-bar"),
    };
  }, texto);
  check(`botón "${texto}" visible y pulsable`, info?.visible && !info?.tapado);
}

// 2. El cálculo de bebidas da el resultado correcto.
await page.locator("#ml").fill("500");
await page.locator("#hc100").fill("91");
await page.waitForTimeout(300);
const readout = page.locator(".readout-value").first();
const valor = ((await readout.textContent()) ?? "").trim();
check("cálculo 500 ml isotónica con 91 g HC/100g = 38,5 g", valor.startsWith("38.5"), valor);

// 3. La tab bar no se superpone al contenido.
const solape = await page.evaluate(() => {
  const m = document.querySelector(".app-main").getBoundingClientRect();
  const b = document.querySelector(".tab-bar").getBoundingClientRect();
  return Math.max(0, m.bottom - b.top);
});
check("la tab bar no tapa el contenido", solape <= 1, `solape=${Math.round(solape)}px`);

// 4. El scroll funciona en el área de contenido.
const scroll = await page.evaluate(async () => {
  const m = document.querySelector(".app-main");
  m.scrollTop = m.scrollHeight;
  await new Promise((r) => requestAnimationFrame(r));
  return { max: m.scrollHeight - m.clientHeight, top: m.scrollTop };
});
check(
  "el contenido se puede desplazar",
  scroll.max === 0 || scroll.top > 0,
  `desplazable=${scroll.max}px`
);

// 5. Las tres pestañas cargan sin errores.
// Ojo: comparamos sin distinguir mayúsculas porque el título se pone en
// mayúsculas por CSS (text-transform), pero el texto real del DOM es "Bebidas".
for (const [tab, titulo] of [
  ["Bebidas", "Bebidas"],
  ["Alimentos", "Alimentos"],
  ["Entreno", "Entreno"],
]) {
  await page.locator(".tab-bar-btn", { hasText: tab }).click();
  await page.waitForTimeout(200);
  const t = (await page.locator(".tab-title").first().textContent()) ?? "";
  check(`pestaña "${tab}"`, t.trim().toLowerCase() === titulo.toLowerCase(), t.trim());
}

// 6. Nada se sale horizontalmente.
const desborda = await page.evaluate(() => {
  const limite = document.querySelector(".app").getBoundingClientRect().right + 1;
  return [...document.querySelectorAll(".app-main *")]
    .filter((el) => el.getBoundingClientRect().right > limite)
    .map((el) => `${el.tagName}.${el.className}`);
});
check("sin desbordes horizontales", desborda.length === 0, desborda.slice(0, 3).join(", "));

// 7. Los ficheros de la PWA están y el manifest es válido.
const manifest = JSON.parse(
  await readFile(join(RAIZ, "manifest.json"), "utf8")
);
check("manifest.json válido", !!manifest.name && Array.isArray(manifest.icons));
for (const icono of ["icon-180.png", "icon-192.png", "icon-512.png"]) {
  check(`icono ${icono} presente`, existsSync(join(RAIZ, icono)));
}

// 8. Sin errores de consola.
check("sin errores en consola", errores.length === 0, errores.slice(0, 2).join(" | "));

await browser.close();
server.close();

console.log(`\n${fallos === 0 ? "TODO CORRECTO" : `${fallos} FALLOS`} en la build de producción`);
process.exit(fallos === 0 ? 0 : 1);
