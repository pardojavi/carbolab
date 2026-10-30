import { useEffect, useMemo, useRef, useState } from "react";
import { DRINK_LIST, DRINKS, fmt, parseNum } from "../constants";
import { computeDrink, salEquivalente } from "../utils/calculations";
import { recognizeLabel } from "../utils/ocr";
import type { DrinkType } from "../types";
import ReadoutCard from "../components/ReadoutCard";
import TextCard from "../components/TextCard";

const ML_SHORTCUTS = [250, 500, 750, 1000];

type OcrStatus = "idle" | "reading" | "done" | "error";

export default function DrinksTab() {
  const [ml, setMl] = useState("500");
  const [drinkKey, setDrinkKey] = useState<DrinkType>("iso");
  const [hc100, setHc100] = useState("");
  const [sodio100, setSodio100] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrMsg, setOcrMsg] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const drink = DRINKS[drinkKey];
  const hasSodio = drink.sodioMinPer500 > 0;

  const result = useMemo(() => {
    const mlNum = parseNum(ml);
    const hcNum = parseNum(hc100);
    const sodioStr = sodio100.trim();
    const sodioNum =
      hasSodio && sodioStr !== "" && !Number.isNaN(parseNum(sodioStr))
        ? parseNum(sodioStr)
        : null;
    if (Number.isNaN(mlNum) || mlNum <= 0 || Number.isNaN(hcNum) || hcNum <= 0) {
      return null;
    }
    return computeDrink(mlNum, drink, hcNum, sodioNum);
  }, [ml, hc100, sodio100, drink, hasSodio]);

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg: string) => {
    setOcrMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setOcrStatus("idle");
      setOcrMsg("");
    }, 8000);
  };

  const handleFile = async (file: File) => {
    setOcrStatus("reading");
    setOcrMsg("Leyendo etiqueta…");
    setOcrRawText("");
    try {
      const res = await recognizeLabel(file, (msg) => setOcrMsg(msg));
      setOcrRawText(res.rawText);
      let found = false;
      if (res.hc !== null) {
        setHc100(String(res.hc));
        found = true;
      }
      if (res.sodio !== null) {
        setSodio100(String(res.sodio));
        found = true;
      }
      if (found) {
        setOcrStatus("done");
        showToast(
          res.hc !== null
            ? "Etiqueta leída y campos rellenados. Comprueba los valores con el texto leído de abajo y corrígelos a mano si hace falta."
            : "He leído la etiqueta pero solo he encontrado el sodio. Escribe los HC a mano mirando el texto leído de abajo."
        );
      } else {
        setOcrStatus("error");
        showToast(
          "No he encontrado HC ni sodio en la foto. Mira el texto leído de abajo: si se lee algo, introduce los valores a mano; si no, repite la foto con más luz y la etiqueta plana y centrada."
        );
      }
    } catch {
      setOcrStatus("error");
      showToast("No he podido leer la foto. Introduce los valores a mano.");
    }
  };

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  return (
    <div className="tab-content">
      <h2 className="tab-title">Bebidas</h2>
      <p className="tab-desc">
        Calcula cuánto producto añadir a tu agua según el tipo de bebida.
      </p>

      <section className="section">
        <label className="field-label" htmlFor="ml">
          Agua a preparar (ml)
        </label>
        <input
          id="ml"
          className="text-input"
          type="text"
          inputMode="decimal"
          value={ml}
          onChange={(e) => setMl(e.target.value)}
          placeholder="500"
        />
        <div className="shortcut-row">
          {ML_SHORTCUTS.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip${parseNum(ml) === v ? " active" : ""}`}
              onClick={() => setMl(String(v))}
            >
              {v}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <span className="field-label">Tipo de bebida</span>
        <div className="drink-grid" role="radiogroup" aria-label="Tipo de bebida">
          {DRINK_LIST.map((d) => (
            <button
              key={d.key}
              type="button"
              role="radio"
              aria-checked={drinkKey === d.key}
              className={`drink-card${drinkKey === d.key ? " active" : ""}`}
              style={drinkKey === d.key ? { borderColor: d.color } : undefined}
              onClick={() => setDrinkKey(d.key)}
            >
              <span className="drink-card-label" style={{ color: d.color }}>
                {d.label}
              </span>
              <span className="drink-card-sub">{d.sub}</span>
              <span className="drink-card-ratio">
                {d.hcPer500} g HC / 500 ml
              </span>
              {d.sodioMinPer500 > 0 && (
                <span className="drink-card-ratio">
                  {fmt(d.sodioMinPer500)}–{fmt(d.sodioMaxPer500)} g sodio / 500 ml
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <label className="field-label" htmlFor="hc100">
          HC del producto (g por 100 g)
        </label>
        <input
          id="hc100"
          className="text-input"
          type="text"
          inputMode="decimal"
          value={hc100}
          onChange={(e) => setHc100(e.target.value)}
          placeholder="Lo que indica la etiqueta"
        />

        {hasSodio && (
          <>
            <label className="field-label" htmlFor="sodio100">
              Sodio del producto (mg por 100 g) · opcional
            </label>
            <input
              id="sodio100"
              className="text-input"
              type="text"
              inputMode="decimal"
              value={sodio100}
              onChange={(e) => setSodio100(e.target.value)}
              placeholder="Solo si tu producto lo lleva"
            />
          </>
        )}

        <div className="ocr-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => cameraRef.current?.click()}
            disabled={ocrStatus === "reading"}
          >
            Hacer foto
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => galleryRef.current?.click()}
            disabled={ocrStatus === "reading"}
          >
            Galería
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onCameraChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onCameraChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {ocrStatus === "reading" && (
          <div className="ocr-status" role="status">
            <span className="spinner" aria-hidden="true" /> {ocrMsg}
          </div>
        )}
        {ocrRawText.trim() !== "" && (
          <details className="ocr-raw">
            <summary>Texto leído de la foto (para verificar o corregir)</summary>
            <pre>{ocrRawText.trim().slice(0, 800)}</pre>
          </details>
        )}
      </section>

      {result && (
        <section className="section">
          <ReadoutCard
            label="Producto a añadir"
            value={fmt(result.gramosProducto)}
            unit="g"
            color={drink.color}
            sub={
              <>
                para {fmt(parseNum(ml) || 0, 2)} ml de agua · {drink.label.toLowerCase()} (
                {drink.hcPer500} g HC / 500 ml)
              </>
            }
          />

          {hasSodio && (
            <div style={{ height: 12 }} />
          )}
          {hasSodio && (
            <TextCard title="Sodio" color={drink.color}>
              {result.sodioAportado === null ? (
                <>
                  + {fmt(result.sodioObjetivoMin)}–{fmt(result.sodioObjetivoMax)} g de sodio (≈{" "}
                  {fmt(salEquivalente(result.sodioObjetivoMin))}–
                  {fmt(salEquivalente(result.sodioObjetivoMax))} g de sal común, o usa
                  citrato/cloruro sódico si tu bebida base no lo trae). Si tu producto ya lleva
                  sodio, ponlo arriba y te digo si te falta añadir algo más.
                </>
              ) : (
                <>
                  Ese producto ya aporta ≈ {fmt(result.sodioAportado)} g de sodio.{" "}
                  {result.sodioFaltanteMax <= 0.01
                    ? "Con eso ya cubres el objetivo de sodio, no hace falta añadir más."
                    : `Aún te faltan ${fmt(result.sodioFaltanteMin)}–${fmt(
                        result.sodioFaltanteMax
                      )} g de sodio (≈ ${fmt(salEquivalente(result.sodioFaltanteMin))}–${fmt(
                        salEquivalente(result.sodioFaltanteMax)
                      )} g de sal común, o usa citrato/cloruro sódico).`}
                </>
              )}
            </TextCard>
          )}
        </section>
      )}

      {ocrStatus !== "idle" && ocrStatus !== "reading" && ocrMsg && (
        <div className={`toast ${ocrStatus === "error" ? "toast-error" : ""}`} role="status">
          {ocrMsg}
        </div>
      )}
    </div>
  );
}
