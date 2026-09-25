// Detecta el marco de película (borde negro del negativo + blanco del escáner) de cada foto de la web
// y guarda en catalogo/instagram-bordes.json la caja útil [izq, arriba, der, abajo] en fracciones de la imagen.
// La usan el editor de Instagram y instagram-aplicar.mjs para recortar a 3:4 / 4:5 sin que se cuele el marco.
// Incremental: solo analiza ids nuevos. Uso: node scripts/instagram-bordes.mjs [--todo]
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'catalogo/instagram-bordes.json');
const ids = [...new Set(JSON.parse(readFileSync(join(ROOT, 'src/data/photos.json'), 'utf8')).map(p => p.id))];
const cache = !process.argv.includes('--todo') && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

const DARK = 70, PRE = 0.06, MAXRUN = 0.08, MARGIN = 0.008;
// perfil de luminancia desde un borde hacia dentro (media de la franja central del otro eje)
function profile(d, w, h, side) {
  const n = side === 'l' || side === 'r' ? w : h, out = new Float32Array(Math.floor(n * 0.15));
  for (let k = 0; k < out.length; k++) {
    let s = 0, c = 0;
    if (side === 'l' || side === 'r') { const x = side === 'l' ? k : w - 1 - k; for (let y = Math.floor(h * .2); y < h * .8; y++) { s += d[y * w + x]; c++; } }
    else { const y = side === 't' ? k : h - 1 - k; for (let x = Math.floor(w * .2); x < w * .8; x++) { s += d[y * w + x]; c++; } }
    out[k] = s / c;
  }
  return { p: out, n };
}
function inset({ p, n }) {
  let k = 0;
  while (k < p.length && k < n * PRE && p[k] >= DARK) k++;          // borde claro del escáner
  if (k >= n * PRE || k >= p.length || p[k] >= DARK) return 0;      // no hay banda negra: foto sin marco
  const start = k;
  while (k < p.length && p[k] < DARK) k++;
  if (k - start > n * MAXRUN) return 0;                              // oscuro «infinito»: es la foto, no el marco
  return Math.min(0.14, k / n + MARGIN);
}

let nuevos = 0;
for (const id of ids) {
  if (cache[id]) continue;
  const f = join(ROOT, 'public/photos', `${id}-800.webp`);
  if (!existsSync(f)) continue;
  const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true });
  const [l, t, r, b] = ['l', 't', 'r', 'b'].map(s => inset(profile(data, info.width, info.height, s)));
  cache[id] = [l, t, 1 - r, 1 - b].map(v => +v.toFixed(4));
  nuevos++;
}
writeFileSync(OUT, JSON.stringify(cache));
console.log(`instagram-bordes.json: ${Object.keys(cache).length} fotos (${nuevos} analizadas ahora)`);
