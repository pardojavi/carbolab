/**
 * Dev server de Vite para las pruebas de navegador.
 *
 * Vitest ejecuta cada fichero de test en su propio worker, así que el módulo
 * NO se comparte entre ellos: cada uno necesita su propio puerto. Por eso
 * pedimos el puerto 0 y dejamos que el sistema operativo nos dé uno libre.
 */
import { existsSync } from "node:fs";
import { createServer, type ViteDevServer } from "vite";

const ETIQUETA = "/tmp/carbolab-etiqueta.png";

export interface AppServer {
  url: string;
}

let cache: Promise<AppServer> | null = null;

async function arrancar(): Promise<AppServer> {
  // Si el usuario define APP_URL, asumimos un servidor ya levantado
  // (por ejemplo `npm run dev` en otra terminal).
  const externa = process.env.APP_URL;
  if (externa) return { url: externa };

  // strictPort false + port 0 → puerto libre asignado por el SO.
  const server: ViteDevServer = await createServer({
    server: { port: 0, strictPort: false },
    logLevel: "error",
  });
  await server.listen();

  const address = server.httpServer?.address();
  const puerto = typeof address === "object" && address ? address.port : 5173;
  return { url: `http://localhost:${puerto}/` };
}

/** Arranca (una sola vez por worker de test) el servidor de pruebas. */
export function startAppServer(): Promise<AppServer> {
  if (!cache) cache = arrancar();
  return cache;
}

/** ¿Está preparada la etiqueta sintética para las pruebas de OCR? */
export function etiquetaDisponible(): boolean {
  return existsSync(ETIQUETA);
}
