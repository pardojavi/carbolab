import type { DrinkDef } from "../types";

export interface DrinkResult {
  hcObjetivo: number; // g de HC a disolver
  gramosProducto: number; // g de producto a añadir
  sodioObjetivoMin: number; // g de sodio objetivo (mínimo)
  sodioObjetivoMax: number; // g de sodio objetivo (máximo)
  sodioAportado: number | null; // g de sodio que ya aporta el producto (null si el usuario no lo indicó)
  sodioFaltanteMin: number; // g de sodio que aún falta (mínimo)
  sodioFaltanteMax: number; // g de sodio que aún falta (máximo)
}

export function computeDrink(
  ml: number,
  drink: DrinkDef,
  hc100: number,
  sodio100mg: number | null
): DrinkResult {
  const hcObjetivo = (drink.hcPer500 * ml) / 500;
  const gramosProducto = hc100 > 0 ? (hcObjetivo / hc100) * 100 : 0;
  const sodioObjetivoMin = (drink.sodioMinPer500 * ml) / 500;
  const sodioObjetivoMax = (drink.sodioMaxPer500 * ml) / 500;
  const sodioAportado =
    sodio100mg !== null && sodio100mg > 0
      ? (gramosProducto * sodio100mg) / 100 / 1000
      : null;
  const sodioFaltanteMin = Math.max(0, sodioObjetivoMin - (sodioAportado ?? 0));
  const sodioFaltanteMax = Math.max(0, sodioObjetivoMax - (sodioAportado ?? 0));
  return {
    hcObjetivo,
    gramosProducto,
    sodioObjetivoMin,
    sodioObjetivoMax,
    sodioAportado,
    sodioFaltanteMin,
    sodioFaltanteMax,
  };
}

/** Conversión sodio -> sal común: 1 g de sodio ≈ 2.5 g de sal. */
export const salEquivalente = (sodioG: number): number => sodioG * 2.5;

export interface Recommendation {
  min: number; // g HC/hora
  max: number; // g HC/hora
  note: string;
  fluidMin: number; // ml/hora
  fluidMax: number; // ml/hora
  drinkAdvice: string;
}

export function recommend(hours: number, intensity: number): Recommendation {
  let min: number;
  let max: number;
  let note: string;

  if (hours < 1) {
    if (intensity >= 8) {
      min = 20;
      max = 30;
      note = "Sesión corta pero muy intensa: conviene algo de HC para sostener el ritmo.";
    } else {
      min = 0;
      max = 15;
      note =
        "Sesión corta y suave: el agua sola suele bastar, o un enjuague/pequeña cantidad de HC.";
    }
  } else if (hours <= 2.5) {
    if (intensity >= 7) {
      min = 45;
      max = 60;
      note = "Duración media a alta intensidad: mantiene el glucógeno y retrasa la fatiga.";
    } else if (intensity >= 4) {
      min = 30;
      max = 45;
      note = "Ritmo moderado: cubre de sobra el gasto sin sobrecargar el estómago.";
    } else {
      min = 20;
      max = 30;
      note = "Ritmo suave: cantidades bajas son suficientes.";
    }
  } else {
    if (intensity >= 6) {
      min = 75;
      max = 90;
      note =
        "Larga duración a buen ritmo: usa fuentes múltiples (glucosa + fructosa 2:1) para absorber más HC/hora sin molestias digestivas.";
    } else {
      min = 60;
      max = 75;
      note =
        "Larga duración suave: aun así el glucógeno se vacía con las horas, mantén un aporte constante.";
    }
  }

  const fluidMin = 500 + (intensity >= 7 ? 100 : 0);
  const fluidMax = 750 + (intensity >= 7 ? 150 : 0);

  let drinkAdvice: string;
  if (max <= 30) {
    drinkAdvice =
      "Bebida hipotónica: prioriza la reposición de líquido sobre el aporte de HC.";
  } else if (max <= 60) {
    drinkAdvice =
      "Bebida isotónica: buen equilibrio entre líquido y energía para la mayoría de salidas.";
  } else {
    drinkAdvice =
      "Combina isotónica + geles/alimentos sólidos: cubrir 75–90 g/h solo con bebida suele sentar mal, repártelo entre líquido y sólido.";
  }

  return { min, max, note, fluidMin, fluidMax, drinkAdvice };
}
