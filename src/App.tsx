import { useState } from "react";
import Header from "./components/Header";
import TabBar, { type TabKey } from "./components/TabBar";
import DrinksTab from "./tabs/DrinksTab";
import FoodsTab from "./tabs/FoodsTab";
import TrainingTab from "./tabs/TrainingTab";

export default function App() {
  const [tab, setTab] = useState<TabKey>("bebidas");

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        {tab === "bebidas" && <DrinksTab />}
        {tab === "alimentos" && <FoodsTab />}
        {tab === "entreno" && <TrainingTab />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}
