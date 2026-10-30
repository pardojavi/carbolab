import { useMemo, useState } from "react";
import { fmt } from "../constants";
import { recommend } from "../utils/calculations";
import ReadoutCard from "../components/ReadoutCard";
import TextCard from "../components/TextCard";

export default function TrainingTab() {
  const [hours, setHours] = useState(2);
  const [intensity, setIntensity] = useState(5);

  const rec = useMemo(() => recommend(hours, intensity), [hours, intensity]);

  const totalMin = Math.round(rec.min * hours);
  const totalMax = Math.round(rec.max * hours);

  return (
    <div className="tab-content">
      <h2 className="tab-title">Entreno</h2>
      <p className="tab-desc">
        Recomendación de HC y líquido según duración e intensidad.
      </p>

      <section className="section">
        <label className="field-label" htmlFor="hours">
          Duración del entreno: <strong className="label-value">{fmt(hours, 2)} h</strong>
        </label>
        <input
          id="hours"
          className="slider"
          type="range"
          min={0.25}
          max={8}
          step={0.25}
          value={hours}
          onChange={(e) => setHours(parseFloat(e.target.value))}
        />
        <div className="slider-scale">
          <span>0,25 h</span>
          <span>8 h</span>
        </div>
      </section>

      <section className="section">
        <label className="field-label" htmlFor="intensity">
          Intensidad: <strong className="label-value">{intensity}/10</strong>
        </label>
        <input
          id="intensity"
          className="slider"
          type="range"
          min={1}
          max={10}
          step={1}
          value={intensity}
          onChange={(e) => setIntensity(parseInt(e.target.value, 10))}
        />
        <div className="slider-scale">
          <span>suave</span>
          <span>máxima</span>
        </div>
      </section>

      <section className="section">
        <div className="readout-grid">
          <ReadoutCard
            label="HC / hora"
            value={`${rec.min}–${rec.max}`}
            unit="g/h"
            color="#C6F135"
          />
          <ReadoutCard
            label="Líquido / hora"
            value={`${rec.fluidMin}–${rec.fluidMax}`}
            unit="ml/h"
            color="#7FD8E8"
          />
        </div>
        <div style={{ height: 12 }} />
        <ReadoutCard
          label="Total HC para toda la sesión"
          value={`${totalMin}–${totalMax}`}
          unit="g"
          color="#FF8C42"
          sub={`para ${fmt(hours, 2)} h de entreno`}
        />
      </section>

      <section className="section">
        <TextCard title="Bebida" color="#C6F135">
          {rec.drinkAdvice}
        </TextCard>
        <div style={{ height: 8 }} />
        <TextCard title="Por qué esta cantidad">{rec.note}</TextCard>
        <div style={{ height: 8 }} />
        <TextCard title="Antes (1–4 h antes)">
          Comida rica en HC de digestión fácil (arroz blanco, pasta, pan, plátano), baja en fibra y
          grasa para no ir pesado a la salida.
        </TextCard>
        <div style={{ height: 8 }} />
        <TextCard title="Durante">
          Empieza a los 15–20 min de rodar, no esperes a notar la pájara. Reparte el total en tomas
          pequeñas cada 15–20 min en vez de todo junto.
        </TextCard>
        <div style={{ height: 8 }} />
        <TextCard title="Después (recuperación)">
          {hours >= 2 || intensity >= 7
            ? "Si entrenas de nuevo en menos de 8 h: 1–1.2 g HC/kg/h durante las primeras 4 h, junto con ~20 g de proteína. Si no, con una comida normal en las 2 h siguientes es suficiente."
            : "Con una comida equilibrada en las 2 h siguientes es suficiente para reponer glucógeno."}
        </TextCard>
      </section>
    </div>
  );
}
