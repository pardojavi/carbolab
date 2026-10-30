export type DrinkType = "hipo" | "iso" | "hiper";

export interface DrinkDef {
  key: DrinkType;
  label: string;
  sub: string;
  hcPer500: number; // g de HC por cada 500 ml de agua
  sodioMinPer500: number; // g de sodio por cada 500 ml de agua
  sodioMaxPer500: number; // g de sodio por cada 500 ml de agua
  color: string;
}

export interface Food {
  id: string;
  name: string;
  hc100: number; // g de HC por 100 g
  unit: number; // gramos de una pieza/porción típica
  unitName: string; // nombre de esa unidad
  prep: (gramos: number, unidades: number) => string;
}

export interface CustomFoodData {
  name: string;
  hc100: number;
  unit: number;
  unitName: string;
}

export interface RecipeItem {
  key: string;
  foodId: string;
  parts: number;
  custom?: CustomFoodData; // solo si es alimento personalizado
  hc100?: number; // override de HC/100g para alimentos personalizados
}

export interface SavedRecipe {
  id: string;
  name: string;
  hcTarget: number;
  items: RecipeItem[];
  savedAt: string; // ISO date
}
