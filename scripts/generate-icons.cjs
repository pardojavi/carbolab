// Genera los iconos PNG de CARBOLAB (180, 192 y 512 px).
// Diseño: fondo #0B1412, cuadrado redondeado #0F1D1B, letra "C" en lima #C6F135.
// Uso: node scripts/generate-icons.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const BG = [11, 20, 18]; // #0B1412
const SURFACE = [15, 29, 27]; // #0F1D1B
const ACCENT = [198, 241, 53]; // #C6F135

function inRoundedRect(px, py, x0, y0, side, r) {
  if (px < x0 || px >= x0 + side || py < y0 || py >= y0 + side) return false;
  const inLeft = px < x0 + r;
  const inRight = px >= x0 + side - r;
  const inTop = py < y0 + r;
  const inBottom = py >= y0 + side - r;
  if ((inLeft || inRight) && (inTop || inBottom)) {
    const cx = inLeft ? x0 + r : x0 + side - r;
    const cy = inTop ? y0 + r : y0 + side - r;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  }
  return true;
}

// "C" como anillo con hueco en el lado derecho (ángulo 0 = este).
function inC(px, py, cx, cy, rOuter, thickness, gapHalfAngle) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > rOuter || d < rOuter - thickness) return false;
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += 2 * Math.PI;
  if (ang <= gapHalfAngle || ang >= 2 * Math.PI - gapHalfAngle) return false;
  return true;
}

function generate(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const side = size * 0.78;
  const r = side * 0.24;
  const rOuter = side * 0.3;
  const thickness = rOuter * 0.45;
  const gapHalfAngle = 0.95; // ~54°

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let c = BG;
      if (inRoundedRect(x + 0.5, y + 0.5, cx - side / 2, cy - side / 2, side, r)) {
        c = SURFACE;
      }
      if (inC(x + 0.5, y + 0.5, cx, cy, rOuter, thickness, gapHalfAngle)) {
        c = ACCENT;
      }
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = 255;
    }
  }
  return png;
}

const outDir = path.join(__dirname, "..", "public");
for (const size of [180, 192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, PNG.sync.write(generate(size)));
  console.log(`Generado ${file}`);
}
