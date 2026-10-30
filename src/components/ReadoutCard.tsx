import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  sub?: ReactNode;
}

/** Tarjeta tipo "readout" de ciclocomputador: label pequeña + valor grande en mono. */
export default function ReadoutCard({ label, value, unit, color, sub }: Props) {
  return (
    <div className="readout-card">
      <div className="readout-label">{label}</div>
      <div className="readout-value" style={color ? { color } : undefined}>
        {value}
        {unit ? <span className="readout-unit"> {unit}</span> : null}
      </div>
      {sub ? <div className="readout-sub">{sub}</div> : null}
    </div>
  );
}
