export type TabKey = "bebidas" | "alimentos" | "entreno";

interface Props {
  tab: TabKey;
  onChange: (tab: TabKey) => void;
}

function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 2h4" />
      <path d="M10 2v3.5c0 .5-.2 1-.6 1.4C7.6 8.4 6.5 10.4 6.5 12.5V20a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 17.5 20v-7.5c0-2.1-1.1-4.1-2.9-5.6-.4-.4-.6-.9-.6-1.4V2" />
      <path d="M6.5 14h11" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M6 3v18" />
      <path d="M18 3a3 3 0 0 0-3 3v5a2 2 0 0 0 2 2h1v8" />
      <path d="M18 3v18" />
    </svg>
  );
}

function BikeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="17" r="3.5" />
      <circle cx="18" cy="17" r="3.5" />
      <path d="M6 17 9.5 9H14" />
      <path d="M14 9 11.5 5H9" />
      <path d="M14 9l4 8" />
      <path d="M9.5 9 8 6h2" />
    </svg>
  );
}

const TABS: Array<{ key: TabKey; label: string; Icon: () => JSX.Element }> = [
  { key: "bebidas", label: "Bebidas", Icon: BottleIcon },
  { key: "alimentos", label: "Alimentos", Icon: FoodIcon },
  { key: "entreno", label: "Entreno", Icon: BikeIcon },
];

export default function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Navegación principal">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className={`tab-bar-btn${tab === key ? " active" : ""}`}
          onClick={() => onChange(key)}
          aria-current={tab === key ? "page" : undefined}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
