/**
 * Pruebas de interfaz con navegador real (Playwright).
 *
 * Reproduce los bugs reportados en la app móvil:
 *  - Los botones "Hacer foto" / "Galería" quedaban tapados por la tab bar.
 *  - El OCR leía mal las cifras de la etiqueta.
 *
 * Ejecutar con el dev server ya levantado:  npm run dev
 */
import { afterAll, beforeAll, beforeEach, describe, expect as vExpect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { expect } from "@playwright/test";
import { startAppServer } from "./helpers/server";

// Las aserciones de UI usan el `expect` de Playwright (matchers de Playwright).
// Para checks numéricos sencillos usamos el de Vitest como `vExpect`.
const expectNum = vExpect;

// iPhone 14 Pro: mismo viewport que la captura del usuario.
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

/** ¿Está el elemento visible y libre de tapones por encima? */
async function esPulsable(page: Page, selector: string): Promise<boolean> {
  const el = page.locator(selector).first();
  if (!(await el.isVisible())) return false;

  const box = await el.boundingBox();
  if (!box) return false;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // ¿Quién está en ese punto? (detecta la tab bar por encima)
  const encima = await page.evaluate(
    ([x, y]) => {
      const top = document.elementFromPoint(x, y);
      return top ? `${top.tagName}.${top.className}` : null;
    },
    [cx, cy]
  );

  // ¿Está dentro del viewport visible?
  const dentroDePantalla = cy >= 0 && cy <= IPHONE.height;
  const tapado = encima === null || encima.includes("tab-bar");
  return dentroDePantalla && !tapado;
}

describe("Layout móvil", () => {
  it("el contenido hace scroll (no queda recortado)", async () => {
    const info = await page.evaluate(() => {
      const main = document.querySelector(".app-main");
      if (!main) return null;
      return {
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        overflowY: getComputedStyle(main).overflowY,
        minHeight: getComputedStyle(main).minHeight,
      };
    });
    expectNum(info).not.toBeNull();
    // min-height:0 es lo que permite que overflow-y:auto funcione en flexbox.
    // Sin esto, el hijo no baja de su altura de contenido y el scroll nunca
    // se activa: el contenido se recorta y los botones inferiores son
    // inalcanzables. Ese era el bug reportado.
    expectNum(info!.minHeight).toBe("0px");
    expectNum(info!.overflowY).toBe("auto");
  });

  it("una pestaña larga se puede desplazar hasta el final", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();

    const fin = await page.evaluate(async () => {
      const main = document.querySelector(".app-main") as HTMLElement;
      main.scrollTop = main.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
      return {
        desplazado: main.scrollTop,
        maximo: main.scrollHeight - main.clientHeight,
      };
    });
    // Si hay contenido que no cabe, debe llegar hasta el final.
    if (fin.maximo > 0) {
      expectNum(fin.desplazado).toBeGreaterThan(0);
      expectNum(fin.desplazado).toBeCloseTo(fin.maximo, -1);
    }

    await page.locator(".tab-bar-btn", { hasText: "Bebidas" }).click();
  });

  it("el botón 'Hacer foto' es visible y pulsable", async () => {
    const btn = page.locator("button", { hasText: "Hacer foto" }).first();
    await btn.scrollIntoViewIfNeeded();
    expectNum(await esPulsable(page, "button:has-text('Hacer foto')")).toBe(true);
  });

  it("el botón 'Galería' es visible y pulsable", async () => {
    const btn = page.locator("button", { hasText: "Galería" }).first();
    await btn.scrollIntoViewIfNeeded();
    expectNum(await esPulsable(page, "button:has-text('Galería')")).toBe(true);
  });

  it("la tab bar está en el flujo, no tapando el contenido", async () => {
    const r = await page.evaluate(() => {
      const bar = document.querySelector(".tab-bar") as HTMLElement | null;
      const main = document.querySelector(".app-main") as HTMLElement | null;
      if (!bar || !main) return null;
      const b = bar.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      return {
        barPosition: getComputedStyle(bar).position,
        barTop: b.top,
        mainBottom: m.bottom,
        overlap: m.bottom - b.top,
      };
    });
    expectNum(r).not.toBeNull();
    // Al estar en el flujo, la barra no se superpone al área de contenido.
    expectNum(r!.barPosition).not.toBe("fixed");
    expectNum(r!.overlap).toBeLessThanOrEqual(1);
  });

  it("los tres tabs son accesibles y cambian de vista", async () => {
    for (const [tab, titulo] of [
      ["Bebidas", "BEBIDAS"],
      ["Alimentos", "Alimentos"],
      ["Entreno", "Entreno"],
    ] as const) {
      const btn = page.locator(".tab-bar-btn", { hasText: tab }).first();
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(page.locator(".tab-title").first()).toBeVisible();
    }
  });
});

describe("Sin desbordes horizontales", () => {
  it("ningún elemento se sale del ancho de la app", async () => {
    for (const tab of ["Bebidas", "Alimentos", "Entreno"]) {
      await page.locator(".tab-bar-btn", { hasText: tab }).click();
      await page.waitForTimeout(150);

      const desbordes = await page.evaluate(() => {
        const app = document.querySelector(".app") as HTMLElement;
        const limite = app.getBoundingClientRect().right + 1;
        const malos: string[] = [];
        for (const el of Array.from(document.querySelectorAll(".app-main *"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > limite) {
            malos.push(`${el.tagName}.${el.className} right=${Math.round(r.right)}`);
          }
        }
        return malos.slice(0, 5);
      });
      expectNum(desbordes, `desborde en ${tab}`).toEqual([]);
    }
  });

  it("el documento no genera scroll horizontal", async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expectNum(overflow).toBe(true);
  });
});

describe("Cálculo de bebidas", () => {
  it("rellena HC y muestra el resultado al escribirlo a mano", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Bebidas" }).click();

    const hc = page.locator("#hc100");
    await hc.fill("91");

    // Con 500 ml isotónica (35 g HC) y 91 g HC/100g → 38,5 g de producto.
    const readout = page.locator(".readout-value").first();
    await expect(readout).toBeVisible();
    const valor = (await readout.textContent()) ?? "";
    expectNum(valor).toContain("38.5");
  });

  it("los chips de volumen cambian el agua a preparar", async () => {
    await page.locator(".chip", { hasText: "750" }).click();
    await expect(page.locator("#ml")).toHaveValue("750");
  });
});

describe("Cálculo de la receta (Alimentos)", () => {
  // Cada test arranca limpio: la app guarda alimentos y recetas en
  // localStorage y el estado de React persiste entre tests dentro del mismo
  // navegador, así que sin esto un test contaminaba al siguiente.
  beforeEach(async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
  });

  /** Lee los gramos que la app asigna a cada ingrediente. */
  async function gramosPorIngrediente(page: Page): Promise<number[]> {
    const textos = await page.locator(".ingredient-result-grams").allTextContents();
    return textos.map((t) => {
      const m = t.match(/([\d.,]+)\s*g/);
      return m ? Number.parseFloat(m[1].replace(",", ".")) : NaN;
    });
  }

  it("propone 30 g de HC por defecto", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    await expect(page.locator("#hcTarget")).toHaveValue("30");
  });

  it("al cambiar los HC objetivo recalcula los gramos", async () => {
    // BUG: al memoizar sin `target` en las dependencias, cambiar el objetivo
    // dejaba los gramos del valor anterior congelados en pantalla.
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    await page.locator("#hcTarget").fill("30");
    const con30 = await gramosPorIngrediente(page);
    expectNum(con30[0]).toBeCloseTo(130.4, 0); // plátano 23 g/100g

    await page.locator("#hcTarget").fill("60");
    const con60 = await gramosPorIngrediente(page);
    expectNum(con60[0]).toBeCloseTo(260.9, 0);

    // Y al volver a 30 deben volver los mismos gramos del principio.
    await page.locator("#hcTarget").fill("30");
    const vuelta = await gramosPorIngrediente(page);
    expectNum(vuelta[0]).toBeCloseTo(con30[0], 1);
  });

  it("el reparto es proporcional al objetivo", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    await page.locator("#hcTarget").fill("40");
    const a40 = await gramosPorIngrediente(page);
    await page.locator("#hcTarget").fill("80");
    const a80 = await gramosPorIngrediente(page);

    // Duplicar el objetivo dobla los gramos de cada ingrediente.
    expectNum(a80[0]).toBeCloseTo(a40[0] * 2, 0);
  });

  it("indica el peso real y los HC de cada ingrediente", async () => {
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");
    await page.waitForTimeout(200);

    // Cada fila dice cuánto pesa y cuánto HC aporta.
    const filas = await page.locator(".ingredient-result").allTextContents();
    expectNum(filas[0]).toContain("130.4 g");
    expectNum(filas[0]).toContain("aporta 30 g de HC");
    expectNum(filas[1]).toContain("37.5 g");
    expectNum(filas[1]).toContain("aporta 30 g de HC");
  });

  it("las piezas salen con decimales, no redondeadas a enteros", async () => {
    // Objetivo 30 g → 130,4 g de plátano → 1,3 plátanos, NO 1. Antes ponía
    // "1 plátano", lo que contradecía el peso y fastidiaba al montar la receta.
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page.locator("#hcTarget").fill("30");
    await page.waitForTimeout(200);

    const texto = (await page.locator(".ingredient-result").first().textContent()) ?? "";
    expectNum(texto).toContain("130.4 g");
    expectNum(texto).toContain("1.3 × plátano mediano (pelado)");
    // Y avisa de lo que implica usar piezas enteras (1,3 → el entero más
    // cercano es 1, o sea 100 g en vez de los 130,4 g exactos).
    expectNum(texto).toContain("1 × plátano mediano (pelado)");
    expectNum(texto).toContain("100 g");
  });

  it("redondea a la pieza entera y avisa de lo que cambia", async () => {
    // Objetivo 60 g → 260,9 g → 2,6 plátanos → 3 enteros = 300 g (69 g de HC).
    // Aquí la diferencia es grande, así que la app avisa.
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page.locator("#hcTarget").fill("60");
    await page.waitForTimeout(200);

    const nota = (await page.locator(".ingredient-result-nota").first().textContent()) ?? "";
    expectNum(nota).toContain("3 × plátano mediano (pelado)");
    expectNum(nota).toContain("300 g");
    expectNum(nota).toContain("69 g de HC");
  });

  it("no avisa cuando la pieza entera casi encaja", async () => {
    // 45 g → 195,7 g → 1,96 plátanos: 2 piezas son 200 g, apenas 4 g de más.
    // No merece la pena un aviso.
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page.locator("#hcTarget").fill("45");
    await page.waitForTimeout(200);

    const texto = (await page.locator(".ingredient-result").first().textContent()) ?? "";
    expectNum(texto).not.toContain("Si solo compras");
  });

  it("avisa del peso cuando solo puedes usar piezas enteras", async () => {
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page.locator("#hcTarget").fill("30");
    await page.waitForTimeout(200);
    // 65,2 g son 0,7 plátanos → 1 entero = 100 g = 23 g de HC.
    const nota = (await page.locator(".ingredient-result-nota").first().textContent()) ?? "";
    expectNum(nota).toContain("1 × plátano mediano (pelado)");
    expectNum(nota).toContain("100 g");
    expectNum(nota).toContain("23 g de HC");
  });

  it("cada peso aparece UNA sola vez, sin lista duplicada", async () => {
    // Decidido: las filas de resultado son la única fuente de verdad. Antes
    // había además una tarjeta "Para montar" que repetía las mismas cifras.
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");
    await page.waitForTimeout(200);

    await expect(page.locator(".text-card", { hasText: "Para montar" })).toHaveCount(0);

    // 130,4 g solo puede aparecer en la fila del plátano y en el texto de
    // preparación; no en una segunda lista de resultados.
    const bloqueResultados = await page
      .locator(".ingredient-result, .readout-card")
      .allTextContents();
    const apariciones = bloqueResultados.join(" ").match(/130\.4/g) ?? [];
    expectNum(apariciones.length).toBe(1);
  });

  it("el total muestra el peso y los HC aportados", async () => {
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");
    await page.waitForTimeout(200);

    const total = (await page.locator(".readout-card").first().textContent()) ?? "";
    expectNum(total).toContain("167.9 g");
    expectNum(total).toContain("aporta 60 g de HC");
  });

  it("pluraliza bien los nombres de una palabra", async () => {
    // Gominolas (80 g/100g) con objetivo 30 g → 37,5 g → 7,5 unidades.
    // Debe salir "unidades", no "unidads".
    await page.locator(".ingredient-row select").first().selectOption("gominolas");
    await page.locator("#hcTarget").fill("30");
    await page.waitForTimeout(200);

    const texto = (await page.locator(".ingredient-result").first().textContent()) ?? "";
    expectNum(texto).toContain("unidades");
    expectNum(texto).not.toContain("unidads");
  });

  it("cada ingrediente se dosifica según SUS hidratos", async () => {
    // Plátano (23 g HC/100g) + Miel (80 g HC/100g), 1 parte cada uno, 60 g de
    // objetivo. Cada uno se lleva 30 g de HC, así que:
    //   plátano → 30 × 100/23 = 130,4 g
    //   miel    → 30 × 100/80 = 37,5 g
    // Antes ambos salían con los mismos gramos.
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");

    const gramos = await gramosPorIngrediente(page);
    expectNum(gramos.length).toBe(2);
    expectNum(gramos[0]).toBeCloseTo(130.4, 1); // plátano
    expectNum(gramos[1]).toBeCloseTo(37.5, 1); // miel

    // Y NO son iguales: ese era el fallo que reportó el usuario.
    expectNum(gramos[0]).not.toBe(gramos[1]);
  });

  it("la suma de HC de todos los ingredientes da el objetivo", async () => {
    await page.locator(".ingredient-row select").first().selectOption("platano");
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");

    const gramos = await gramosPorIngrediente(page);
    // 130,4 g × 23% + 37,5 g × 80% = 30 + 30 = 60 g de HC exactos.
    const hc = gramos[0] * 0.23 + gramos[1] * 0.8;
    expectNum(hc).toBeCloseTo(60, 0);
  });

  it("las partes reparten el presupuesto de HC", async () => {
    // 3 partes de plátano y 1 de miel sobre 60 g de objetivo:
    // plátano se lleva 45 g de HC (196 g) y miel 15 g (18,8 g).
    await page.locator(".ingredient-row select").first().selectOption("platano");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Añadir una parte" }).nth(0).click();
    }
    await page
      .getByRole("button", { name: "+ Añadir otro ingrediente a la receta" })
      .click();
    await page.locator(".ingredient-row select").last().selectOption("miel");
    await page.locator("#hcTarget").fill("60");

    const gramos = await gramosPorIngrediente(page);
    expectNum(gramos[0]).toBeCloseTo((45 * 100) / 23, 0); // 195,7 g
    expectNum(gramos[1]).toBeCloseTo((15 * 100) / 80, 0); // 18,8 g
  });

  it("con un solo ingrediente da los gramos exactos", async () => {
    // Miel al 80%: 60 g de HC necesitan 60/0,8 = 75 g de producto.
    await page.locator(".ingredient-row select").first().selectOption("miel");
    await page.locator("#hcTarget").fill("60");
    const gramos = await gramosPorIngrediente(page);
    expectNum(gramos[0]).toBeCloseTo(75, 1);
  });

  it("avisa si un alimento no tiene HC/100 g definido", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    await page
      .locator(".ingredient-row select")
      .first()
      .selectOption("+ Crear alimento nuevo…");
    await page.locator("#cName").fill("Producto sin HC");
    await page.locator(".custom-form button", { hasText: "Guardar alimento" }).click();

    // Una sola fila con un alimento sin HC no se puede repartir: hay que
    // decirlo, no dejar la pantalla vacía sin explicación.
    await expect(page.locator(".empty-state, .aviso")).toBeVisible();
  });
});

describe("Pestaña de alimentos", () => {
  beforeEach(async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
  });

  it("'Crear alimento nuevo…' es la última opción del selector", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();

    const select = page.locator(".ingredient-row select").first();
    const ultima = await select.locator("option").last().textContent();
    expectNum(ultima?.trim()).toBe("+ Crear alimento nuevo…");
  });

  it("elegir 'Crear alimento nuevo…' abre el formulario", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();

    await expect(page.locator(".custom-form")).toHaveCount(0);
    await page
      .locator(".ingredient-row select")
      .first()
      .selectOption("+ Crear alimento nuevo…");

    await expect(page.locator(".custom-form")).toBeVisible();
    // El selector sigue mostrando el alimento real, no la opción nueva.
    const valor = await page.locator(".ingredient-row select").first().inputValue();
    expectNum(valor).not.toBe("__nuevo_alimento__");
  });

  it("el botón grande añade otro ingrediente", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();

    const btn = page.getByRole("button", { name: "+ Añadir otro ingrediente a la receta" });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText("+ Añadir otro ingrediente a la receta");

    const antes = await page.locator(".ingredient-row select").count();
    await btn.click();
    const despues = await page.locator(".ingredient-row select").count();
    expectNum(despues).toBe(antes + 1);
  });

  it("el botón grande usa borde discontinuo", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    const estilo = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        x.textContent?.includes("Añadir otro ingrediente")
      );
      if (!b) return null;
      return { estilo: getComputedStyle(b).borderStyle };
    });
    expectNum(estilo?.estilo).toBe("dashed");
  });

  it("el texto 'Cerrar alimento personalizado' ya no existe", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();
    const html = (await page.content()).toLowerCase();
    expect(html).not.toContain("cerrar alimento personalizado");
  });

  it("al guardar un alimento nuevo, queda ya seleccionado en la receta", async () => {
    await page.locator(".tab-bar-btn", { hasText: "Alimentos" }).click();

    const antes = await page.locator(".ingredient-row select").count();
    await page
      .locator(".ingredient-row select")
      .first()
      .selectOption("+ Crear alimento nuevo…");

    await page.locator("#cName").fill("Gel casero test");
    await page.locator(".custom-form button", { hasText: "Guardar alimento" }).click();

    // Aparece como opción disponible en todos los selectores.
    const select = page.locator(".ingredient-row select").first();
    await expect(select.locator("option", { hasText: "Gel casero test" })).toHaveCount(1);

    // Y además se añade como fila nueva ya seleccionada.
    const despues = await page.locator(".ingredient-row select").count();
    expectNum(despues).toBe(antes + 1);

    const ultimaFila = page.locator(".ingredient-row select").last();
    const valor = await ultimaFila.inputValue();
    const texto = await ultimaFila.locator(`option[value="${valor}"]`).textContent();
    expectNum(texto).toContain("Gel casero test");

    // Pide el HC/100 g para poder calcular las proporciones.
    await expect(page.locator(".custom-hc-row")).toBeVisible();
  });
});
