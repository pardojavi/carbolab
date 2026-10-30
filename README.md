# CARBOLAB — Nutrición deportiva para ciclismo

Webapp (PWA) para calcular hidratos de carbono y sodio en Drink, Alimentos y Entreno.
**React + Vite + TypeScript.** Sin backend, sin cuentas, sin servicios de pago.
Los datos se guardan en el `localStorage` del navegador.

## Cómo probarla en el iPhone

La app es una webapp, no una app nativa: se ejecuta en Safari y se puede instalar
en la pantalla de inicio.

### 1. En el Mac (con el iPhone en la misma wifi)

```bash
npm install
npm run dev -- --host
```

Esto imprime una URL tipo `http://192.168.1.50:5173/`. Ábrela en el Safari del
iPhone con esa IP.

### 2. Instalarla en la pantalla de inicio

En Safari del iPhone: **Compartir → "Añadir a pantalla de inicio"**.
Abre a pantalla completa, con icono propio y sin barra de navegador.

> Importante: Safari **no** permite usar la cámara con `capture` si la página
> se sirve por `file://`. Hay que servirla por HTTP (pasos 1 o 3).

### 3. Publicarla como web (opcional)

```bash
npm run build      # genera dist/
```

La carpeta `dist/` es estática y se puede subir tal cual a **GitHub Pages**,
Netlify, Vercel o cualquier hosting. `base: "./"` en `vite.config.ts` hace que
funcione también en subcarpetas.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run dev -- --host` | Desarrollo accesible desde el iPhone |
| `npm run build` | Compila a `dist/` |
| `npm test` | Suite de tests (59 tests) |
| `npm run test:ui` | Solo tests de interfaz en navegador |
| `npm run test:ocr` | Genera una etiqueta y prueba el OCR real |
| `node scripts/verify-dist.mjs` | Verifica la build de producción |
| `node scripts/shot.mjs` | Capturas de pantalla en `/tmp/carbolab-shots` |

## Estructura

```
src/
  App.tsx              # raíz, gestiona las pestañas
  components/          # Header, TabBar, ReadoutCard, TextCard
  tabs/                # DrinksTab, FoodsTab, TrainingTab
  utils/
    calculations.ts    # matemática de bebidas y recomendaciones
    ocr.ts             # lectura de etiquetas con Tesseract.js
    storage.ts         # persistencia en localStorage
tests/                 # 59 tests (unitarios + navegador real)
scripts/               # utilidades de verificación y capturas
```

## OCR de etiquetas

Usa **Tesseract.js** desde la CDN, sin claves de API. Lee HC y sodio de la foto.

El parser (`src/utils/ocr.ts`) está diseñado para etiquetas reales, donde el OCR
suele equivocarse:

- Parsea **línea a línea**: la cifra debe estar en la misma fila que la palabra
  clave, para no coger el número de la fila siguiente.
- Acepta la unidad pegada (`91g`) y con la primera letra perdida (`idratos`).
- Convierte confusiones típicas de caracteres (`O`↔`0`, `l`↔`1`, `S`↔`5`).
- Convierte siempre a las unidades correctas: sodio en mg, sal en mg de sodio.

**Siempre revisa los valores leídos antes de fiarte**: con foto borrosa, con
reflejos o con la etiqueta curva puede fallar. Los campos son editables a mano
justamente por eso. La primera lectura tarda más porque descarga el paquete de
idioma (se cachea después).

## Requisitos

- Node 18 o superior
- Para los tests: `npx playwright install chromium` (una sola vez)
