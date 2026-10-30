/**
 * OCR 100% en el navegador con Tesseract.js v5 (cargado vía CDN en index.html).
 * Gratis, sin clave de API, sin servicios de pago.
 *
 * Estrategia para leer etiquetas nutricionales reales con precisión:
 * 1. Preprocesado en dos variantes: gris+contraste y binarizado con umbral
 *    adaptativo (integrales), para soportar fotos con mala luz o fondo de color.
 * 2. VARIOS intentos con distintos modos PSM (6 = bloque uniforme, 4 = columna
 *    única, 3 = automático). Se para en cuanto se extraen HC y sodio.
 *    Sin whitelist de caracteres: las etiquetas van en MAYÚSCULAS y forzar
 *    minúsculas destruye la precisión de Tesseract.
 * 3. Parseo por LÍNEAS: cada cifra se asocia a la palabra clave de SU fila,
 *    evitando comerse la cifra de la fila siguiente.
 * 4. Filtros de plausibilidad: HC entre 0,1 y 100 g/100 g; sodio ≤ 5000 mg/100 g.
 */

/** Normaliza el texto OCR en una lista de líneas limpias. */
function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.toLowerCase().replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
}

/**
 * Limpia ruido OCR típico junto a dígitos: "l2"→"12", "1O"→"10", "4OO"→"400".
 * Solo toca letras adyacentes a dígitos, así no corrompe palabras reales.
 */
function limpiarRuido(linea: string): string {
  return linea
    .replace(/[lI](\d)/g, (_m, d) => `1${d}`)
    .replace(/(\d)[lI](?=\d)/g, (_m, d) => `${d}1`)
    .replace(/(\d)[Oo](?=\D|$)/g, (_m, d) => `${d}0`)
    .replace(/(\d)O(?=\d)/g, (_m, d) => `${d}0`);
}

/**
 * Convierte una cadena casi-numérica de OCR en número, arreglando las
 * confusiones de caracteres habituales. Devuelve null si no es creíble.
 */
export function coerceNumber(raw: string): number | null {
  const s = raw.trim();
  if (s === "" || !/\d/.test(s)) return null;

  const fixed = s
    .replace(/[Oo]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[,\s]/g, ".")
    .replace(/[^0-9.]/g, "");
  if (fixed === "") return null;
  const v = parseFloat(fixed);
  if (!Number.isFinite(v) || v < 0 || v > 1000) return null;
  return v;
}

/**
 * Extrae el primer número creíble que sigue a `desde` en la línea.
 * Acepta como separador previo: espacio, punto (líderes ". . ."), ":", "=",
 * ",", ";", "(", "-", "·", "/" y "[". NO acepta letras ni dígitos pegados,
 * para no leer "100" de "g/100 g".
 */
function numeroEnLinea(
  linea: string,
  desde: number,
  rango: { min: number; max: number }
): number | null {
  const resto = limpiarRuido(linea.slice(desde));
  const re =
    /(?:^|[\s:=;,(\[.\-\/·])(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:gr|mg|g)?(?![\p{L}\d])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(resto)) !== null) {
    const v = coerceNumber(m[1] ?? "");
    if (v === null) continue;
    if (v >= rango.min && v <= rango.max) return v;
  }
  return null;
}

const RANGO_HC = { min: 0.1, max: 100 }; // g de HC por 100 g de producto
const RANGO_SODIO_MG = { min: 0.1, max: 5000 }; // mg de sodio por 100 g
const RANGO_SAL_G = { min: 0.01, max: 20 }; // g de sal por 100 g

const TERMINOS_HC = [
  "hidratos de carbono",
  "hidratos de carbon",
  "hidratos",
  "carbohidratos",
  "car-bohidratos",
];

/**
 * Extrae los hidratos de carbono (g/100 g) del texto OCR de una etiqueta.
 * Prioriza SIEMPRE el número de la MISMA línea que la palabra clave.
 */
export function extractCarbsFromText(raw: string): number | null {
  const lineas = normalizeLines(raw);

  // 1) Misma línea que "hidratos de carbono" (caso normal de tabla).
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    for (const t of TERMINOS_HC) {
      // Probamos el término completo y también sin su primera letra, porque
      // el OCR se come a menudo el primer carácter de la línea.
      for (const variante of [t, t.length >= 5 ? t.slice(1) : ""]) {
        if (variante === "") continue;
        const idx = linea.indexOf(variante);
        if (idx === -1) continue;
        // Si entre la palabra clave y el número aparece "azúcar", ese número
        // pertenece a la fila "de los cuales azúcares": lo descartamos para
        // no confundir azúcares con el total de hidratos.
        const despues = linea.slice(idx + variante.length);
        const hastaDigito = despues.search(/\d/) === -1 ? despues.length : despues.search(/\d/);
        if (!/az[uú]car/.test(despues.slice(0, hastaDigito))) {
          const v = numeroEnLinea(despues, 0, RANGO_HC);
          if (v !== null) return v;
          // Algunas etiquetas parten la fila: palabra clave en una línea y la
          // cifra sola en la siguiente. Solo si la siguiente empieza por número.
          const sig = lineas[i + 1];
          if (sig && /^[^\d]{0,6}\d/.test(sig)) {
            const v2 = numeroEnLinea(sig, 0, RANGO_HC);
            if (v2 !== null) return v2;
          }
        }
      }
    }
  }

  // 2) Fallback: "de los cuales azúcares X g" solo si no hay fila de hidratos.
  for (const linea of lineas) {
    const idx = linea.indexOf("azúcar") !== -1 ? linea.indexOf("azúcar") : linea.indexOf("azucar");
    if (idx === -1) continue;
    const v = numeroEnLinea(linea, idx + 6, RANGO_HC);
    if (v !== null) return v;
  }

  // 3) Fallback final: "HC: X" o "HC X".
  for (const linea of lineas) {
    const m = linea.match(/(?:^|[\s;:])hc[:\s]+(\d{1,3}(?:[.,]\d{1,2})?)\s*(g|mg)?/);
    if (m) {
      const v = coerceNumber(m[1]);
      if (v !== null && v >= RANGO_HC.min && v <= RANGO_HC.max) return v;
    }
  }

  return null;
}

/**
 * Extrae el sodio del texto OCR, normalizando SIEMPRE a miligramos.
 * Entiende "sodio X mg / X g" y también "Sal: X g" (convirtiendo sal→sodio).
 */
export function extractSodiumMgFromText(raw: string): number | null {
  const lineas = normalizeLines(raw);

  // 1) Sodio explícito, en su misma línea (tolerando que falte la "h").
  for (const linea of lineas) {
    for (const variante of ["sodio", "odio"]) {
      const idx = linea.indexOf(variante);
      if (idx === -1) continue;
      const resto = linea.slice(idx + variante.length);

      let m = resto.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*mg/);
      if (m) {
        const v = coerceNumber(m[1]);
        if (v !== null && v >= RANGO_SODIO_MG.min && v <= RANGO_SODIO_MG.max) return v;
      }
      m = resto.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*g\b/);
      if (m) {
        const v = coerceNumber(m[1]);
        if (v !== null && v * 1000 <= RANGO_SODIO_MG.max) return v * 1000; // g → mg
      }
      // Sin unidad explícita: heurística g vs mg según magnitud.
      m = resto.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*$/);
      if (m) {
        const v = coerceNumber(m[1]);
        if (v !== null) {
          const mg = v < 20 ? v * 1000 : v;
          if (mg >= RANGO_SODIO_MG.min && mg <= RANGO_SODIO_MG.max) return mg;
        }
      }
    }
  }

  // 2) "Sal: X g" → sodio = (X g × 1000) / 2.5.
  for (const linea of lineas) {
    // "sal" debe ser la palabra ENTERA: "salsa" o "salmorejo" se descartan.
    const m = linea.match(/(?<![\p{L}])sals?(?:es)?(?![\p{L}])[\s:=]*(\d{1,2}(?:[.,]\d{1,2})?)/u);
    if (m) {
      const v = coerceNumber(m[1]);
      if (v !== null && v >= RANGO_SAL_G.min && v <= RANGO_SAL_G.max) {
        return (v * 1000) / 2.5;
      }
    }
  }

  return null;
}

export interface OcrResult {
  hc: number | null;
  sodio: number | null;
  /** Texto completo reconocido, para que el usuario pueda verificar/corregir. */
  rawText: string;
}

/** Redondea a 2 decimales como máximo para no rellenar "65.333333". */
const round2 = (v: number): number => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ */
/* Preprocesado de imagen                                              */
/* ------------------------------------------------------------------ */

interface ImagenPrep {
  gris: HTMLCanvasElement;
  binaria: HTMLCanvasElement;
  w: number;
  h: number;
}

async function decodeImagen(file: File): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    return { src: bmp, w: bmp.width, h: bmp.height };
  }
  // Fallback para navegadores sin createImageBitmap.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("No se pudo abrir la imagen."));
    img.src = URL.createObjectURL(file);
  });
}

async function prepararImagen(file: File): Promise<ImagenPrep> {
  const { src, w, h } = await decodeImagen(file);
  // Escalamos a un tamaño óptimo para Tesseract (demasiado grande = lento,
  // demasiado pequeño = ilegible). Tope de 2400px por el RAM del iPhone.
  const OBJETIVO = 2000;
  const scale = Math.min(3, Math.max(1, OBJETIVO / Math.max(w, h)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  (src as ImageBitmap).close?.();

  const { width: cw, height: ch } = canvas;
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const gray = new Float32Array(cw * ch);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // Contraste por percentiles (2%..98%): sensible a la luz de la foto.
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  const total = gray.length;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const stretch = new Float32Array(gray.length);
  const rango = Math.max(20, hi - lo);
  for (let i = 0; i < gray.length; i++) {
    stretch[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / rango));
  }

  return {
    gris: aCanvas(stretch, cw, ch),
    binaria: aCanvas(umbralAdaptativo(stretch, cw, ch), cw, ch),
    w: cw,
    h: ch,
  };
}

function aCanvas(gray: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const v = gray[i];
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Binarizado adaptativo (media local vía imagen integral): aguanta sombras. */
function umbralAdaptativo(gray: Float32Array, w: number, h: number, c = 14): Float32Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const win = Math.max(31, Math.floor(Math.min(w, h) / 12) | 1);
  const half = win >> 1;
  const out = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      const suma =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      out[y * w + x] = gray[y * w + x] > suma / area - c ? 255 : 0;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Reconocimiento                                                      */
/* ------------------------------------------------------------------ */

interface TesseractWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words?: TesseractWord[];
}

interface TesseractBlock {
  paragraphs?: Array<{ lines?: TesseractLine[] }>;
  lines?: TesseractLine[];
}

function recogerLineas(bloques: TesseractBlock[] | undefined): TesseractLine[] {
  if (!Array.isArray(bloques)) return [];
  const out: TesseractLine[] = [];
  for (const b of bloques) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) if (l) out.push(l);
    }
    for (const l of b.lines ?? []) if (l) out.push(l);
  }
  return out;
}

/**
 * Reconstruye el texto usando la geometría de las palabras.
 * Tesseract puede devolver el texto en un orden distinto al visual;
 * reordenar por (banda vertical, x) hace que "91 g" acabe pegado a
 * "Hidratos de carbono" y no a la fila de arriba.
 */
function textoOrdenado(lineas: TesseractLine[]): string {
  const conAlto = lineas
    .filter((l) => l && typeof l.text === "string" && l.text.trim() !== "")
    .map((l) => ({ l, alto: Math.max(1, l.bbox.y1 - l.bbox.y0) }));
  if (conAlto.length === 0) return "";

  const ordenadas = [...conAlto].sort((a, b) => a.l.bbox.y0 - b.l.bbox.y0);
  const bandas: Array<{ y0: number; y1: number; lineas: typeof ordenadas }> = [];
  for (const item of ordenadas) {
    const cy = (item.l.bbox.y0 + item.l.bbox.y1) / 2;
    const banda = bandas.find(
      (b) => cy >= b.y0 - item.alto * 0.5 && cy <= b.y1 + item.alto * 0.5
    );
    if (banda) {
      banda.lineas.push(item);
      banda.y0 = Math.min(banda.y0, item.l.bbox.y0);
      banda.y1 = Math.max(banda.y1, item.l.bbox.y1);
    } else {
      bandas.push({ y0: item.l.bbox.y0, y1: item.l.bbox.y1, lineas: [item] });
    }
  }

  return bandas
    .sort((a, b) => a.y0 - b.y0)
    .map((banda) =>
      [...banda.lineas]
        .sort((a, b) => a.l.bbox.x0 - b.l.bbox.x0)
        .map((i) => i.l.text.replace(/\s+/g, " ").trim())
        .join(" ")
    )
    .filter((t) => t !== "")
    .join("\n");
}

/** Intentos en cadena: se para en cuanto tenemos HC y sodio (o tras agotarlos). */
const INTENTOS: Array<{ psm: string; binaria: boolean }> = [
  { psm: "6", binaria: false }, // bloque uniforme (tabla con filas marcadas)
  { psm: "4", binaria: false }, // columna única de tamaño variable
  { psm: "3", binaria: true }, // automático sobre imagen binarizada
];

/**
 * Reconoce una imagen de etiqueta y devuelve HC (g/100g), sodio (mg/100g)
 * y el texto leído. La primera llamada descarga el paquete de idioma;
 * el navegador lo cachea.
 */
export async function recognizeLabel(
  file: File,
  onProgress?: (msg: string) => void
): Promise<OcrResult> {
  const Tesseract = (window as unknown as { Tesseract?: any }).Tesseract;
  if (!Tesseract) {
    throw new Error("Tesseract.js no está disponible (sin conexión a la CDN).");
  }

  onProgress?.("Preparando imagen…");
  const prep = await prepararImagen(file);

  const worker = await Tesseract.createWorker("spa", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(`Leyendo etiqueta… ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    // Sin whitelist de caracteres: forzar minúsculas hundía la precisión,
    // porque las etiquetas van en MAYÚSCULAS.
    await worker.setParameters({ preserve_interword_spaces: "1" });

    let mejor: OcrResult = { hc: null, sodio: null, rawText: "" };
    let mejorPuntos = -1;

    for (let i = 0; i < INTENTOS.length; i++) {
      const intento = INTENTOS[i];
      onProgress?.(`Leyendo etiqueta… (intento ${i + 1}/${INTENTOS.length})`);
      await worker.setParameters({ tessedit_pageseg_mode: intento.psm });

      const { data } = await worker.recognize(intento.binaria ? prep.binaria : prep.gris);
      const lineas = recogerLineas(data?.blocks);
      const texto = lineas.length > 0 ? textoOrdenado(lineas) : data?.text || "";

      const hc = extractCarbsFromText(texto);
      const sodio = extractSodiumMgFromText(texto);
      const puntos = (hc !== null ? 2 : 0) + (sodio !== null ? 1 : 0);
      if (puntos > mejorPuntos) {
        mejorPuntos = puntos;
        mejor = {
          hc: hc !== null ? round2(hc) : null,
          sodio: sodio !== null ? Math.round(sodio) : null,
          rawText: texto,
        };
      }
      if (hc !== null && sodio !== null) break; // resultado completo: no insistimos
    }

    return mejor;
  } finally {
    await worker.terminate();
  }
}
