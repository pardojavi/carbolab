import type { CustomFoodData, SavedRecipe } from "../types";

const KEY = "carbolab_recetas";
const CUSTOM_FOODS_KEY = "carbolab_custom_foods";

/**
 * Persistencia en localStorage del navegador: sobrevive a cerrar y reabrir
 * la app en el mismo dispositivo/navegador, sin backend ni cuenta de usuario.
 */
export async function loadRecipes(): Promise<SavedRecipe[]> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedRecipe[]) : [];
  } catch {
    return [];
  }
}

export async function persistRecipes(list: SavedRecipe[]): Promise<boolean> {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Alimentos personalizados del usuario (persisten entre sesiones). */
export function loadCustomFoods(): CustomFoodData[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FOODS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CustomFoodData[]) : [];
  } catch {
    return [];
  }
}

export function persistCustomFoods(list: CustomFoodData[]): boolean {
  try {
    localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
