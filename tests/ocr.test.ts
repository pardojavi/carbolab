import { describe, expect, it } from "vitest";
import {
  coerceNumber,
  extractCarbsFromText,
  extractSodiumMgFromText,
} from "../src/utils/ocr";

/**
 * Textos simulados de etiquetas nutricionales españolas, con las líneas
 * tal y como las devuelve el OCR (ruido incluido).
 */

describe("coerceNumber", () => {
  it("interpreta números normales", () => {
    expect(coerceNumber("91")).toBe(91);
    expect(coerceNumber("12,5")).toBe(12.5);
    expect(coerceNumber("0.7")).toBe(0.7);
  });

  it("corrige confusiones típicas de caracteres junto a dígitos", () => {
    expect(coerceNumber("9l")).toBe(91);
    expect(coerceNumber("l2")).toBe(12);
    expect(coerceNumber("1O")).toBe(10);
    expect(coerceNumber("1OO")).toBe(100);
    expect(coerceNumber("1B")).toBe(18);
    expect(coerceNumber("9g")).toBe(99);
  });

  it("rechaza valores no plausibles, vacíos o sin dígitos", () => {
    expect(coerceNumber("")).toBeNull();
    expect(coerceNumber("abc")).toBeNull();
    // Sin ningún dígito no hay nada que recuperar: no inventamos un número.
    expect(coerceNumber("B")).toBeNull();
    expect(coerceNumber("OO")).toBeNull();
    expect(coerceNumber("9999")).toBeNull();
  });
});

describe("extractCarbsFromText", () => {
  it("lee el caso que fallaba: 91 g en su propia línea", () => {
    const texto = `
      Información nutricional
      Por porción 30 g
      Valor energético 130 kcal
      Proteínas 0,3 g
      Hidratos de carbono 91 g
      de los cuales azúcares 89 g
      Grasas 0,1 g
      Sal 0,01 g
    `;
    expect(extractCarbsFromText(texto)).toBe(91);
  });

  it("no se come la cifra de la línea siguiente (regresión 91→99)", () => {
    // La etiqueta pone 91 g y un "100 g" suelto por la tabla.
    // El parser antiguo tomaba "99" por culpa de la ventana de 80 chars.
    const texto = `
      Hidratos de carbono 91 g
      Fibra alimentaria 0,9 g
      Proteínas 99 g
    `;
    expect(extractCarbsFromText(texto)).toBe(91);
  });

  it("funciona con la cifra en la línea de al lado (tabla a dos columnas)", () => {
    const texto = `
      Información nutricional por 100 g
      Valor energético 400 kcal
      Hidratos de carbono 91 g
      de los cuales azúcares 80 g
      Proteínas 6 g
    `;
    expect(extractCarbsFromText(texto)).toBe(91);
  });

  it("entiende decimales con coma", () => {
    const texto = `
      HIDRATOS DE CARBONO 12,5 g
      Proteínas 2 g
    `;
    expect(extractCarbsFromText(texto)).toBe(12.5);
  });

  it("acepta 'carbohidratos' sin tilde", () => {
    const texto = "Carbohidratos 45 g\nProteínas 3 g";
    expect(extractCarbsFromText(texto)).toBe(45);
  });

  it("funciona con ruido OCR de mayúsculas/minúsculas", () => {
    const texto = "HIDRATOS DE CARBONO 30 g\nAZUCARES 20 g";
    expect(extractCarbsFromText(texto)).toBe(30);
  });

  it("usa azúcares como fallback si no aparece la palabra HC", () => {
    const texto = "Valor energético 200 kcal\nde los cuales azúcares 15 g";
    expect(extractCarbsFromText(texto)).toBe(15);
  });

  it("entiende el formato 'HC: 42'", () => {
    const texto = "Información nutricional\nHC: 42 g por ración";
    expect(extractCarbsFromText(texto)).toBe(42);
  });

  it("devuelve null si no hay nada de carbs", () => {
    const texto = "Agua mineral\nSin azucar añadidos\n0 kcal";
    expect(extractCarbsFromText(texto)).toBeNull();
  });

  it("ignora el 100 g de la cabecera y usa el valor real", () => {
    const texto = `
      Información nutricional por 100 g
      Hidratos de carbono 55 g
    `;
    expect(extractCarbsFromText(texto)).toBe(55);
  });

  // ---- Regresiones sacadas del OCR real sobre una etiqueta generada ----

  it("entiende la unidad pegada al número ('91g' sin espacio)", () => {
    // Tesseract devuelve "91g" en vez de "91 g".
    expect(extractCarbsFromText("idratos de carbono 91g")).toBe(91);
    expect(extractCarbsFromText("Hidratos de carbono 12,5g")).toBe(12.5);
  });

  it("encuentra la palabra aunque el OCR pierda la primera letra", () => {
    // "idratos" / "hidratos": se corta el primer carácter de la línea.
    expect(extractCarbsFromText("idratos de carbono 91g")).toBe(91);
    expect(extractCarbsFromText("carbohidratos 40g")).toBe(40);
  });

  it("gana la fila de HC aunque el azúcar venga corrupta como '889'", () => {
    // Caso real: Tesseract leyó "88 g" como "889" en la fila de azúcares.
    // El parser debe seguir devolviendo 91 de la fila de HC.
    const texto = `
      alor energético 400 kcal
      roteínas 6 g
      idratos de carbono 91g
      de los cuales azúcares 889
      rasas 1,29
      odio 250 mg
    `;
    expect(extractCarbsFromText(texto)).toBe(91);
  });
});

describe("extractSodiumMgFromText — regresiones de OCR real", () => {
  it("encuentra sodio aunque falte la primera letra ('odio')", () => {
    expect(extractSodiumMgFromText("odio 250 mg")).toBe(250);
  });

  it("no confunde 'Sodio' con otras líneas de la tabla", () => {
    const texto = `
      idratos de carbono 91g
      rasas 1,29
      odio 250 mg
    `;
    expect(extractSodiumMgFromText(texto)).toBe(250);
  });

  it("lee el sodio con decimales", () => {
    expect(extractSodiumMgFromText("Sodio 0,25 g")).toBe(250);
  });
});

describe("extractSodiumMgFromText", () => {
  it("lee sodio en mg", () => {
    const texto = `
      Hidratos de carbono 91 g
      Sodio 250 mg
    `;
    expect(extractSodiumMgFromText(texto)).toBe(250);
  });

  it("convierte sodio en gramos a miligramos", () => {
    const texto = "Sodio 0,25 g\nAzúcares 10 g";
    expect(extractSodiumMgFromText(texto)).toBe(250);
  });

  it("convierte sal en gramos a sodio en mg (÷2,5)", () => {
    const texto = "Sal 0,5 g\nHidratos de carbono 80 g";
    expect(extractSodiumMgFromText(texto)).toBe(200);
  });

  it("no confunde 'sal' con palabras que empiezan igual", () => {
    // "Salsa" no debe interpretarse como sal. Tomamos la línea "Sal 0,3 g".
    // 0,3 g de sal × 1000 / 2,5 = 120 mg de sodio.
    const texto = "Salsa de soja 0,6 g\nSal 0,3 g";
    expect(extractSodiumMgFromText(texto)).toBe(120);
  });

  it("descarta 'salsa' aunque sea la única coincidencia", () => {
    expect(extractSodiumMgFromText("Salsa de soja 0,6 g")).toBeNull();
    expect(extractSodiumMgFromText("Salmorejo 0,4 g")).toBeNull();
  });

  it("acepta plurales de sal", () => {
    expect(extractSodiumMgFromText("Sales 0,5 g")).toBe(200);
  });

  it("aplica la heurística g vs mg cuando no hay unidad", () => {
    const texto = "Sodio 15\nHidratos 20 g";
    // 15 < 20 → se interpreta como gramos → 15000 mg.
    expect(extractSodiumMgFromText(texto)).toBe(15000);
  });

  it("devuelve null si no hay sodio ni sal", () => {
    const texto = "Agua\nHidratos de carbono 10 g";
    expect(extractSodiumMgFromText(texto)).toBeNull();
  });
});
