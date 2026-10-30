import { describe, expect, it } from "vitest";
import { computeDrink, recommend, salEquivalente } from "../src/utils/calculations";
import { DRINKS } from "../src/constants";
import { fmt, parseNum } from "../src/constants";

describe("computeDrink", () => {
  it("calcula gramos de producto para isotónica", () => {
    // 500 ml isotónica = 35 g HC objetivo; producto con 50 g HC/100g
    // → 35 / 50 * 100 = 70 g de producto.
    const r = computeDrink(500, DRINKS.iso, 50, null);
    expect(r.hcObjetivo).toBe(35);
    expect(r.gramosProducto).toBe(70);
  });

  it("escala linealmente con los ml", () => {
    const r = computeDrink(1000, DRINKS.iso, 50, null);
    expect(r.hcObjetivo).toBe(70);
    expect(r.gramosProducto).toBe(140);
  });

  it("no divide por cero si el producto no tiene HC", () => {
    const r = computeDrink(500, DRINKS.iso, 0, null);
    expect(r.gramosProducto).toBe(0);
    expect(Number.isFinite(r.gramosProducto)).toBe(true);
  });

  it("descuenta el sodio que ya aporta el producto", () => {
    // 70 g de producto con 200 mg/100g → 70*200/100/1000 = 0,14 g sodio.
    // Objetivo iso 500 ml = 0,7 g. Faltan 0,56 g.
    const r = computeDrink(500, DRINKS.iso, 50, 200);
    expect(r.sodioAportado).toBeCloseTo(0.14, 5);
    expect(r.sodioFaltanteMin).toBeCloseTo(0.56, 5);
  });

  it("no reporta sodio faltante negativo", () => {
    // Producto muy rico en sodio: el faltante se queda en 0, nunca en negativo.
    const r = computeDrink(500, DRINKS.iso, 50, 5000);
    expect(r.sodioFaltanteMin).toBe(0);
    expect(r.sodioFaltanteMax).toBe(0);
  });

  it("hipotónica no tiene objetivo de sodio", () => {
    const r = computeDrink(500, DRINKS.hipo, 10, null);
    expect(r.sodioObjetivoMin).toBe(0);
    expect(r.sodioObjetivoMax).toBe(0);
  });
});

describe("salEquivalente", () => {
  it("usa el factor 2,5 (1 g sodio ≈ 2,5 g sal)", () => {
    expect(salEquivalente(1)).toBe(2.5);
    expect(salEquivalente(0.7)).toBe(1.75);
  });
});

describe("recommend", () => {
  it("devuelve rangos coherentes y min < max", () => {
    for (const hours of [0.25, 0.5, 1, 2, 3, 5, 8]) {
      for (const intensity of [1, 4, 6, 8, 10]) {
        const r = recommend(hours, intensity);
        expect(r.min).toBeGreaterThanOrEqual(0);
        expect(r.max).toBeGreaterThan(r.min);
        expect(r.fluidMin).toBeGreaterThan(0);
        expect(r.fluidMax).toBeGreaterThan(r.fluidMin);
      }
    }
  });

  it("sube la recomendación con la intensidad", () => {
    const suave = recommend(2, 2);
    const fuerte = recommend(2, 9);
    expect(fuerte.min).toBeGreaterThan(suave.min);
  });

  it("sube la recomendación con la duración", () => {
    const corta = recommend(1, 5);
    const larga = recommend(5, 5);
    expect(larga.min).toBeGreaterThan(corta.min);
  });

  it("da más líquido a mayor intensidad", () => {
    expect(recommend(2, 9).fluidMin).toBeGreaterThan(recommend(2, 2).fluidMin);
  });
});

describe("fmt", () => {
  it("quita decimales innecesarios", () => {
    expect(fmt(2)).toBe("2");
    expect(fmt(2.5)).toBe("2.5");
    expect(fmt(2.44)).toBe("2.4");
  });

  it("respeta los decimales máximos", () => {
    expect(fmt(1.234, 2)).toBe("1.23");
  });
});

describe("parseNum", () => {
  it("acepta coma o punto decimal", () => {
    expect(parseNum("12,5")).toBe(12.5);
    expect(parseNum("12.5")).toBe(12.5);
  });

  it("devuelve NaN para basura", () => {
    expect(Number.isNaN(parseNum("abc"))).toBe(true);
  });
});
