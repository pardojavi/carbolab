import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" para que la PWA funcione también bajo subpaths (GitHub Pages, etc.)
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts"],
    // Las pruebas de UI y de OCR necesitan un navegador de verdad.
    environment: "node",
    // Cada test de UI recarga la página para partir de estado limpio, así que
    // la suite tarda bastante. El OCR además descarga el idioma de la CDN.
    testTimeout: 60_000,
    hookTimeout: 90_000,
  },
});
