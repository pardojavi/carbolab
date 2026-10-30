import type { DrinkDef, DrinkType, Food } from "./types";

export const DRINKS: Record<DrinkType, DrinkDef> = {
  hipo: {
    key: "hipo",
    label: "Hipotónica",
    sub: "esfuerzo suave / mucho calor",
    hcPer500: 15,
    sodioMinPer500: 0,
    sodioMaxPer500: 0,
    color: "#7FD8E8",
  },
  iso: {
    key: "iso",
    label: "Isotónica",
    sub: "uso general en bici",
    hcPer500: 35,
    sodioMinPer500: 0.7,
    sodioMaxPer500: 0.7,
    color: "#C6F135",
  },
  hiper: {
    key: "hiper",
    label: "Hipertónica",
    sub: "gran necesidad de HC, poco volumen",
    hcPer500: 45,
    sodioMinPer500: 0.6,
    sodioMaxPer500: 0.7,
    color: "#FF8C42",
  },
};

export const DRINK_LIST: DrinkDef[] = [DRINKS.hipo, DRINKS.iso, DRINKS.hiper];

/** Formatea un número sin decimales innumerarios: 2 -> "2", 2.5 -> "2.5" */
export const fmt = (x: number, maxDec = 1): string => {
  const r = Math.round(x * 10 ** maxDec) / 10 ** maxDec;
  return Number.isInteger(r) ? String(r) : r.toFixed(maxDec);
};

/** Formatea aceptando coma decimal del usuario. Devuelve NaN si no es válido. */
export const parseNum = (s: string): number => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const n = (x: number): string => fmt(x);

export const FOODS: Food[] = [
  {
    id: "platano",
    name: "Plátano",
    hc100: 23,
    unit: 100,
    unitName: "plátano mediano (pelado)",
    prep: (g, u) =>
      `Pela y lleva ${n(g)} g (~${n(u)} plátanos medianos). Mejor maduro: se digiere más rápido.`,
  },
  {
    id: "tortita",
    name: "Tortita de trigo (fajita)",
    hc100: 50,
    unit: 35,
    unitName: "tortita",
    prep: (g, u) =>
      `Lleva ${n(u)} tortitas (${n(g)} g). Enróllalas o úntalas: fáciles de abrir con una mano en marcha.`,
  },
  {
    id: "nocilla",
    name: "Nocilla / crema de cacao",
    hc100: 56,
    unit: 15,
    unitName: "cucharada",
    prep: (g, u) =>
      `Unta ${n(g)} g (~${n(u)} cucharadas) sobre tortita o pan blanco, o mételo en un mini-bote flexible.`,
  },
  {
    id: "mermelada",
    name: "Mermelada",
    hc100: 60,
    unit: 20,
    unitName: "cucharada",
    prep: (g, u) =>
      `Unta ${n(g)} g (~${n(u)} cucharadas) en tortita o pan. Rápida de absorber, ideal para el tramo final.`,
  },
  {
    id: "miel",
    name: "Miel",
    hc100: 80,
    unit: 25,
    unitName: "cucharada",
    prep: (g, u) =>
      `Lleva ${n(g)} g (~${n(u)} cucharadas). Directa sobre tortita o en un bote: azúcar rapidísimo.`,
  },
  {
    id: "guayaba",
    name: "Dulce de guayaba",
    hc100: 70,
    unit: 30,
    unitName: "porción",
    prep: (g, u) =>
      `Porciones de ${n(g)} g (~${n(u)}). Dulce denso de HC: córtalo en trozos pequeños para masticar sobre la bici.`,
  },
  {
    id: "membrillo",
    name: "Carne de membrillo",
    hc100: 70,
    unit: 30,
    unitName: "porción",
    prep: (g, u) =>
      `Porciones de ${n(g)} g (~${n(u)}). Clásico de ciclista: pega los trozos en un papel o en el maillot.`,
  },
  {
    id: "datiles",
    name: "Dátiles",
    hc100: 75,
    unit: 8,
    unitName: "dátil",
    prep: (g, u) =>
      `Lleva ${n(u)} dátiles (${n(g)} g). Cómodos de pelar con una mano; mejor sin hueso para no parar.`,
  },
  {
    id: "pasas",
    name: "Pasas",
    hc100: 79,
    unit: 30,
    unitName: "puñado",
    prep: (g, u) =>
      `Un puñado de ${n(g)} g (~${n(u)}). Energía concentrada en poco volumen, fácil de dosificar en marcha.`,
  },
  {
    id: "higos",
    name: "Higos secos",
    hc100: 63,
    unit: 20,
    unitName: "higo",
    prep: (g, u) =>
      `Lleva ${n(u)} higos secos (${n(g)} g). Córtalos por la mitad y pásalos a un bote para ir comiendo sin parar.`,
  },
  {
    id: "gominolas",
    name: "Gominolas",
    hc100: 80,
    unit: 5,
    unitName: "unidad",
    prep: (g, u) =>
      `Lleva ${n(u)} gominolas (${n(g)} g). Abre el bolso con una mano y ve echando; el azúcar llega volando.`,
  },
  {
    id: "pan",
    name: "Pan blanco",
    hc100: 53,
    unit: 30,
    unitName: "rebanada",
    prep: (g, u) =>
      `Lleva ${n(u)} rebanadas (${n(g)} g). Mejor pan de molde blanco: blando, fácil de masticar y de untar.`,
  },
  {
    id: "avena",
    name: "Copos de avena",
    hc100: 60,
    unit: 40,
    unitName: "puñado (medio bol)",
    prep: (g, u) =>
      `Puñados de ${n(g)} g (~${n(u)}). Ideal en tortitas o mezclada con miel: HC de liberación más lenta.`,
  },
  {
    id: "barrita",
    name: "Barrita de cereales",
    hc100: 68,
    unit: 25,
    unitName: "barrita",
    prep: (g, u) =>
      `Lleva ${n(u)} barritas (${n(g)} g). Abre el envoltorio antes de salir y déjalas a mano en el maillot.`,
  },
  {
    id: "compota",
    name: "Compota de manzana (bolsita)",
    hc100: 20,
    unit: 90,
    unitName: "bolsita",
    prep: (g, u) =>
      `Bolsitas de ${n(g)} g (~${n(u)}). Textura blanda, fácil de tragar a ritmo alto sin masticar.`,
  },
  {
    id: "platanochips",
    name: "Chips de plátano",
    hc100: 65,
    unit: 20,
    unitName: "puñado pequeño",
    prep: (g, u) =>
      `Un puñado pequeño de ${n(g)} g (~${n(u)}). Crujiente y dulce: alternativa a las gominolas con algo más de "comida".`,
  },
  {
    id: "cola",
    name: "Refresco de cola",
    hc100: 10.6,
    unit: 250,
    unitName: "vaso (250 ml)",
    prep: (g, u) =>
      `${n(g)} ml (~${n(u)} vasos de 250 ml). Clásico del tramo final: azúcar rápido + cafeína. Quítale el gas antes de bebértelo de golpe.`,
  },
];
