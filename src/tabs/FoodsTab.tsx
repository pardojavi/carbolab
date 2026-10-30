import { useEffect, useMemo, useState } from "react";
import { FOODS, fmt, parseNum } from "../constants";
import {
  loadCustomFoods,
  loadRecipes,
  persistCustomFoods,
  persistRecipes,
} from "../utils/storage";
import type { Food, RecipeItem, SavedRecipe } from "../types";
import ReadoutCard from "../components/ReadoutCard";
import TextCard from "../components/TextCard";

type View = "nueva" | "guardadas";

let keyCounter = 0;
const nextKey = () => `item-${Date.now()}-${keyCounter++}`;

/** Valor de la opción "crear alimento nuevo" del selector. */
const NUEVO_ALIMENTO = "__nuevo_alimento__";

/**
 * Describe una cantidad de piezas de forma legible. Añadir "s" a pelo daba
 * "plátano mediano (pelado)s" y "unidads"; aquí pluralizamos solo los nombres
 * de una palabra y para las frases usamos la forma "N × nombre".
 */
function describeUnidad(cantidad: number, unitName: string): string {
  if (unitName.includes(" ")) return `${fmt(cantidad, 1)} × ${unitName}`;
  if (Math.abs(cantidad - 1) < 0.05) return unitName;
  if (/idad$/.test(unitName)) return `${fmt(cantidad, 1)} ${unitName}es`; // unidades
  if (/ión$/.test(unitName)) {
    return `${fmt(cantidad, 1)} ${unitName.slice(0, -3)}iones`; // porciones
  }
  return `${fmt(cantidad, 1)} ${unitName}s`;
}

const genericPrep =
  (name: string, unitName: string) =>
  (gramos: number, unidades: number) =>
    `${fmt(gramos)} g (~${fmt(unidades)} ${unitName}s) de ${name}.`;

export default function FoodsTab() {
  const [view, setView] = useState<View>("nueva");

  // Alimentos personalizados (persisten en localStorage)
  const [customFoods, setCustomFoods] = useState<Food[]>(() =>
    loadCustomFoods().map((c, i) => ({
      id: `custom-${i}-${c.name.replace(/\s+/g, "-").toLowerCase()}`,
      name: c.name,
      hc100: c.hc100,
      unit: c.unit,
      unitName: c.unitName,
      prep: genericPrep(c.name, c.unitName),
    }))
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("25");
  const [customUnitName, setCustomUnitName] = useState("porción");

  // Constructor
  const [hcTarget, setHcTarget] = useState("30");
  const [items, setItems] = useState<RecipeItem[]>([
    { key: nextKey(), foodId: "platano", parts: 1 },
  ]);

  // Guardadas
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [search, setSearch] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    void loadRecipes().then(setRecipes);
  }, []);

  const availableFoods = useMemo(() => [...FOODS, ...customFoods], [customFoods]);

  const findFood = (id: string): Food | undefined => availableFoods.find((f) => f.id === id);

  const foodName = (item: RecipeItem): string => {
    if (item.custom) return item.custom.name;
    return findFood(item.foodId)?.name ?? "(alimento desconocido)";
  };

  // Reparto proporcional
  const target = parseNum(hcTarget);
  const targetValid = !Number.isNaN(target) && target > 0;

  const rows = useMemo(() => {
    if (!targetValid) return [];

    // Cada "parte" es la PORCIÓN DEL PRESUPUESTO DE HC que se lleva ese
    // ingrediente, no su peso. Con eso los gramos de cada uno salen de SU
    // propio contenido en hidratos:
    //
    //   hcObjetivo_i = objetivo × partes_i / Σpartes
    //   gramos_i     = hcObjetivo_i × 100 / hc100_i
    //
    // Antes se repartía por peso (gramos = partes × k, con la misma k para
    // todos), así que plátano y miel a 1 parte-each acababan con la misma
    // cantidad de gramos, cuando la miel concentra 3,5 veces más HC.
    const totalPartes = items.reduce((a, it) => a + it.parts, 0);
    if (totalPartes <= 0) return [];

    return items
      .map((it) => {
        const f = findFood(it.foodId);
        if (!f) return null;
        const hc100 = it.hc100 ?? f.hc100;
        // Sin HC conocido no se puede dosificar (ver el aviso de más abajo).
        if (hc100 <= 0) return null;
        const hc = (target * it.parts) / totalPartes;
        const gramos = (hc * 100) / hc100;

        // Cantidad de piezas EXACTA, con decimales. Antes se hacía
        // `Math.max(1, Math.round(...))`, que mentía: para 130,4 g de plátano
        // (pieza = 100 g) decía "1 plátano" cuando hacen falta 1,3, y si
        // tocaba menos de una pieza te obligaba a poner una entera.
        const unidades = gramos / f.unit;

        // Y la cantidad entera "de mercado", por si hay que pesar piezas
        // completas: 2 plátanos son 200 g, no 130,4 g.
        const piezas = Math.max(1, Math.round(unidades));
        const gramosPiezas = piezas * f.unit;
        const hcPiezas = (gramosPiezas * hc100) / 100;
        const hayRedondeo = Math.abs(unidades - piezas) > 0.1;

        return {
          item: it,
          food: f,
          gramos,
          unidades,
          hc,
          piezas,
          gramosPiezas,
          hcPiezas,
          hayRedondeo,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    // OJO: `target` tiene que estar en las dependencias. Antes no lo estaba, así
    // que al cambiar los HC objetivo el memo NO se recalculaba (targetValid
    // sigue siendo true) y la app se quedaba con los gramos del valor anterior.
  }, [items, target, targetValid, availableFoods]);

  const totalGramos = rows.reduce((a, r) => a + r.gramos, 0);
  const totalHc = rows.reduce((a, r) => a + r.hc, 0);

  // Alimentos sin HC/100 g conocido: sin ellos no se puede repartir nada.
  // Antes la pantalla se quedaba vacía sin explicación, y eso es justo lo que
  // hace que el usuario piense que la cuenta va mal.
  const sinHc = items.filter((it) => {
    const f = findFood(it.foodId);
    if (!f) return false;
    return (it.hc100 ?? f.hc100) <= 0;
  });
  const sinHcNombres = sinHc.map((it) => foodName(it));

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 4000);
  };

  // --- Alimento personalizado ---
  const saveCustomFood = () => {
    const name = customName.trim();
    if (name === "") {
      showToast("Ponle un nombre al alimento.");
      return;
    }
    const unit = parseNum(customUnit);
    const unitName = customUnitName.trim() || "porción";
    const unitVal = Number.isNaN(unit) || unit <= 0 ? 25 : unit;
    const id = `custom-${Date.now()}`;
    const newFood: Food = {
      id,
      name,
      hc100: 0, // sin HC por defecto; se edita en el constructor
      unit: unitVal,
      unitName,
      prep: genericPrep(name, unitName),
    };
    setCustomFoods((prev) => {
      const next = [...prev, newFood];
      // Persistir datos completos en localStorage
      persistCustomFoods(
        next.map((f) => ({
          name: f.name,
          hc100: f.hc100,
          unit: f.unit,
          unitName: f.unitName,
        }))
      );
      return next;
    });
    // Al guardar, el alimento entra directamente en la receta como una fila
    // más, ya seleccionado. Así el usuario vuelve al constructor con algo útil
    // en vez de tener que buscarlo en el desplegable.
    setItems((prev) => [...prev, { key: nextKey(), foodId: id, parts: 1 }]);
    setCustomName("");
    setCustomUnit("25");
    setCustomUnitName("porción");
    setShowCustomForm(false);
    showToast("«${name}» añadido a la receta. Pon su HC/100 g para calcular las proporciones.");
  };

  // --- Constructor ---
  const addItem = () =>
    setItems((prev) => [...prev, { key: nextKey(), foodId: "platano", parts: 1 }]);

  const removeItem = (key: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));

  const setParts = (key: string, delta: number) =>
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, parts: Math.max(1, Math.min(20, i.parts + delta)) } : i
      )
    );

  const setItemFood = (key: string, foodId: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, foodId } : i)));

  const setItemHc = (key: string, hc100: number | undefined) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, hc100 } : i)));

  // --- Guardar / cargar / eliminar recetas ---
  const saveRecipe = () => {
    const name = recipeName.trim();
    if (name === "" || rows.length === 0) return;
    // Embebemos los datos completos de alimentos personalizados para poder reconstruirlos
    const record: SavedRecipe = {
      id: `recipe-${Date.now()}`,
      name,
      hcTarget: target,
      items: items.map((i) => {
        if (i.foodId.startsWith("custom-")) {
          const f = findFood(i.foodId);
          if (f) {
            return {
              ...i,
              custom: { name: f.name, hc100: f.hc100, unit: f.unit, unitName: f.unitName },
            };
          }
        }
        return i;
      }),
      savedAt: new Date().toISOString(),
    };
    const next = [record, ...recipes];
    setRecipes(next);
    void persistRecipes(next);
    setShowSave(false);
    setRecipeName("");
    showToast("Receta guardada.");
  };

  const loadRecipe = (r: SavedRecipe) => {
    // Reconstruir alimentos personalizados embebidos
    const customs: Food[] = [];
    const restored = r.items.map((i) => {
      if (i.custom) {
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        customs.push({
          id,
          name: i.custom.name,
          hc100: i.custom.hc100,
          unit: i.custom.unit,
          unitName: i.custom.unitName,
          prep: genericPrep(i.custom.name, i.custom.unitName),
        });
        return { ...i, foodId: id, custom: undefined };
      }
      return i;
    });
    if (customs.length > 0) {
      setCustomFoods((prev) => {
        const existing = new Set(prev.map((c) => c.name));
        return [...prev, ...customs.filter((c) => !existing.has(c.name))];
      });
    }
    setHcTarget(String(r.hcTarget));
    setItems(restored);
    setView("nueva");
    showToast(`Receta "${r.name}" cargada en el constructor.`);
  };

  const deleteRecipe = (id: string) => {
    const next = recipes.filter((r) => r.id !== id);
    setRecipes(next);
    void persistRecipes(next);
    showToast("Receta eliminada.");
  };

  const filtered = recipes.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q === "") return true;
    if (r.name.toLowerCase().includes(q)) return true;
    return r.items.some((i) => foodName(i).toLowerCase().includes(q));
  });

  return (
    <div className="tab-content">
      <h2 className="tab-title">Alimentos</h2>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "nueva"}
          className={`segmented-btn${view === "nueva" ? " active" : ""}`}
          onClick={() => setView("nueva")}
        >
          Nueva receta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "guardadas"}
          className={`segmented-btn${view === "guardadas" ? " active" : ""}`}
          onClick={() => setView("guardadas")}
        >
          Guardadas ({recipes.length})
        </button>
      </div>

      {view === "nueva" && (
        <>
          <section className="section">
            <label className="field-label" htmlFor="hcTarget">
              HC objetivo total de la receta (g)
            </label>
            <input
              id="hcTarget"
              className="text-input"
              type="text"
              inputMode="decimal"
              value={hcTarget}
              onChange={(e) => setHcTarget(e.target.value)}
              placeholder="30"
            />
          </section>

          <section className="section">
            <div className="field-label">
              Ingredientes (reparto de HC por partes)
            </div>
            {items.map((it) => {
              const isCustom = it.foodId.startsWith("custom-");
              return (
                <div key={it.key}>
                  <div className="ingredient-row">
                    <select
                      className="select-input"
                      value={it.foodId}
                      onChange={(e) => {
                        // La última opción no es un alimento: abre el formulario
                        // para crear uno nuevo. El select es controlado, así que
                        // al no cambiar foodId vuelve a mostrar el alimento real.
                        if (e.target.value === NUEVO_ALIMENTO) {
                          setShowCustomForm(true);
                        } else {
                          setItemFood(it.key, e.target.value);
                        }
                      }}
                      aria-label="Alimento"
                    >
                      {availableFoods.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                          {f.hc100 > 0 ? ` (${f.hc100} g HC/100 g)` : ""}
                        </option>
                      ))}
                      <option value={NUEVO_ALIMENTO}>+ Crear alimento nuevo…</option>
                    </select>
                    <div className="stepper">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setParts(it.key, -1)}
                        aria-label="Quitar una parte"
                      >
                        −
                      </button>
                      <span className="stepper-value">{it.parts}</span>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setParts(it.key, 1)}
                        aria-label="Añadir una parte"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeItem(it.key)}
                      aria-label="Quitar ingrediente"
                      disabled={items.length <= 1}
                    >
                      ×
                    </button>
                  </div>
                  {isCustom && (
                    <div className="custom-hc-row">
                      <label className="field-label" htmlFor={`hc-${it.key}`}>
                        HC/100 g (edita según tu producto)
                      </label>
                      <input
                        id={`hc-${it.key}`}
                        className="text-input"
                        type="text"
                        inputMode="decimal"
                        value={it.hc100 ?? ""}
                        onChange={(e) => {
                          const v = parseNum(e.target.value);
                          setItemHc(it.key, e.target.value.trim() === "" || Number.isNaN(v) ? undefined : v);
                        }}
                        placeholder="Ej. 65"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="btn btn-dashed full"
              onClick={addItem}
              title="+ Añadir otro ingrediente a la receta"
            >
              + Añadir otro ingrediente a la receta
            </button>

            {showCustomForm && (
              <div className="custom-form">
                <label className="field-label" htmlFor="cName">
                  Nombre
                </label>
                <input
                  id="cName"
                  className="text-input"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej. Mi gel casero"
                />
                <label className="field-label" htmlFor="cUnit">
                  Gramos por pieza (opcional)
                </label>
                <input
                  id="cUnit"
                  className="text-input"
                  type="text"
                  inputMode="decimal"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="25"
                />
                <label className="field-label" htmlFor="cUnitName">
                  Nombre de la pieza (opcional)
                </label>
                <input
                  id="cUnitName"
                  className="text-input"
                  type="text"
                  value={customUnitName}
                  onChange={(e) => setCustomUnitName(e.target.value)}
                  placeholder="porción"
                />
                <button
                  type="button"
                  className="btn btn-primary full"
                  onClick={saveCustomFood}
                  disabled={customName.trim() === ""}
                >
                  Guardar alimento
                </button>
              </div>
            )}
          </section>

          {sinHcNombres.length > 0 && (
            <section className="section">
              <div className="aviso">
                <strong>Falta información para repart.</strong> No se puede
                calcular el reparto hasta que estos alimentos tengan sus HC/100
                g: {sinHcNombres.join(", ")}.
                {sinHc.some((it) => it.foodId.startsWith("custom-")) && (
                  <>
                    {" "}
                    Pon el valor en el campo «HC/100 g» que aparece bajo el
                    ingrediente.
                  </>
                )}
              </div>
            </section>
          )}

          {rows.length > 0 && sinHcNombres.length === 0 && (
            <section className="section">
              {rows.map(
                ({ item, food, gramos, unidades, hc, piezas, gramosPiezas, hcPiezas, hayRedondeo }) => (
                <div key={item.key} className="ingredient-result">
                  <div className="ingredient-result-name">
                    {food.name} <span className="muted">· {item.parts} parte(s)</span>
                    <div className="ingredient-result-hc">
                      aporta {fmt(hc, 1)} g de HC · {food.hc100} g HC/100 g
                    </div>
                  </div>
                  <div className="ingredient-result-grams">
                    {fmt(gramos)} g
                    <span className="muted"> ≈ {describeUnidad(unidades, food.unitName)}</span>
                  </div>
                  {hayRedondeo && (
                    <div className="ingredient-result-nota">
                      Si solo compras piezas enteras: {describeUnidad(piezas, food.unitName)}{" "}
                      = {fmt(gramosPiezas)} g ({fmt(hcPiezas, 1)} g de HC).
                    </div>
                  )}
                </div>
              )
              )}

              <div style={{ height: 12 }} />
              <ReadoutCard
                label="Total mezcla"
                value={fmt(totalGramos)}
                unit="g"
                color="#C6F135"
                sub={`aporta ${fmt(totalHc, 1)} g de HC · objetivo ${fmt(
                  targetValid ? target : 0
                )} g`}
              />

              <div style={{ height: 12 }} />
              {rows.map(({ item, food, gramos, unidades }) => (
                <div key={`prep-${item.key}`}>
                  <TextCard title={food.name}>{food.prep(gramos, unidades)}</TextCard>
                  <div style={{ height: 8 }} />
                </div>
              ))}

              <button
                type="button"
                className="btn btn-primary full"
                onClick={() => setShowSave(true)}
              >
                Guardar receta
              </button>
            </section>
          )}

          {showSave && (
            <div className="modal-backdrop" onClick={() => setShowSave(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Guardar receta</div>
                <input
                  className="text-input"
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Nombre de la receta (ej. Tortita nocilla + plátano)"
                  autoFocus
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowSave(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveRecipe}
                    disabled={recipeName.trim() === ""}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === "guardadas" && (
        <section className="section">
          {recipes.length === 0 ? (
            <p className="empty-state">
              Aún no hay recetas guardadas. Crea una en "Nueva receta" y pulsa "Guardar receta".
            </p>
          ) : (
            <>
              <input
                className="text-input"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o ingrediente…"
                aria-label="Buscar recetas"
              />
              {filtered.length === 0 && (
                <p className="empty-state">Sin resultados para "{search}".</p>
              )}
              {filtered.map((r) => (
                <div key={r.id} className="recipe-card">
                  <div className="recipe-card-head">
                    <div className="recipe-card-name">{r.name}</div>
                    <div className="recipe-card-meta">
                      {fmt(r.hcTarget)} g HC · {new Date(r.savedAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <div className="recipe-card-items">
                    {r.items.map((i) => `${foodName(i)} ×${i.parts}`).join(" · ")}
                  </div>
                  <div className="recipe-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => loadRecipe(r)}
                    >
                      Cargar en el constructor
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => deleteRecipe(r.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
