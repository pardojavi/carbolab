import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
  color?: string;
}

/** Tarjeta de texto para bloques de recomendación. */
export default function TextCard({ title, children, color }: Props) {
  return (
    <div className="text-card" style={color ? { borderLeftColor: color } : undefined}>
      {title ? (
        <div className="text-card-title" style={color ? { color } : undefined}>
          {title}
        </div>
      ) : null}
      <div className="text-card-body">{children}</div>
    </div>
  );
}
