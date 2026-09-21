// Optimiza las fotos de /fotos y genera src/data/photos.json
//   fotos/portrait | editorial | lifestyle      -> Fotografía
//   fotos/portada                                -> Portada (orden manual)
//   fotos/works.json  { "faces/Sesión/foto.jpg": ["scrapworld"] }  -> asignación manual a Works (si no, reglas de src/data/works.json)
// Uso: npm run photos   (se ejecuta solo antes de dev y build)
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync, readFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'fotos');
const OUT = join(ROOT, 'public/photos');
const DATA = join(ROOT, 'src/data/photos.json');
const CATS = ['faces', 'editorial', 'lifestyle', 'portada'];
const WORKS = JSON.parse(readFileSync(join(ROOT, 'src/data/works.json'), 'utf8'));
const manualWorks = existsSync(join(SRC, 'works.json')) ? JSON.parse(readFileSync(join(SRC, 'works.json'), 'utf8')) : {};
const rx = (list) => (list || []).map((r) => new RegExp(r, 'i'));
const worksFor = (rel) => manualWorks[rel] ?? WORKS.filter((w) => rx(w.match).some((r) => r.test(rel)) && !rx(w.exclude).some((r) => r.test(rel))).map((w) => w.slug);
const EXT = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);

// En Cloudflare no existen los originales (fotos/ no se sube): se usan las imágenes ya generadas en public/photos.
if (!existsSync(SRC)) { console.log('ℹ sin carpeta fotos/: se mantienen las imágenes ya generadas'); process.exit(0); }
mkdirSync(OUT, { recursive: true });
mkdirSync(join(ROOT, 'src/data'), { recursive: true });
// Títulos: fotos/titulos.json  { "faces/Proyecto/archivo.jpg": "Nombre · Lugar · 2024" }
const titles = existsSync(join(SRC, 'titulos.json')) ? JSON.parse(readFileSync(join(SRC, 'titulos.json'), 'utf8')) : {};

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.has(extname(name).toLowerCase())) yield p;
  }
}

function classify(file) {
  const [a, b] = relative(SRC, file).split('/');
  if (a === 'portada') { const m = (b || '').match(/^\d+_(.+?)__/); return { cat: 'home', proj: m ? m[1].replace(/_/g, ' ') : undefined }; }
  if (CATS.includes(a)) return { cat: a, proj: b };
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const photos = [];
const seenContent = new Set();
let dupes = 0;
for (const file of walk(SRC)) {
  const meta = classify(file);
  if (!meta) continue;
  // Misma foto (mismo contenido) dentro de la misma categoría/proyecto: solo una vez.
  const sha = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12);
  const key = meta.cat + ':' + sha;
  if (seenContent.has(key)) { dupes++; continue; }
  seenContent.add(key);
  const id = createHash('sha1').update(relative(SRC, file)).digest('hex').slice(0, 10);
  const small = join(OUT, `${id}-800.webp`);
  const large = join(OUT, `${id}-1600.webp`);
  const base = sharp(file, { failOn: 'none' }).rotate();
  const info = await base.clone().metadata();
  const rotated = info.orientation && info.orientation >= 5;
  const w = rotated ? info.height : info.width;
  const h = rotated ? info.width : info.height;
  if (!existsSync(large)) await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(large);
  if (!existsSync(small)) await base.clone().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(small);
  const { data } = await sharp(small).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  const n = data.length / 3;
  const { h: hue, s, l } = rgbToHsl(r / n, g / n, b / n);
  const ratio = +(w / h).toFixed(4);
  const rel = relative(SRC, file);
  const title = titles[rel] || '';
  const works = meta.cat === 'home' ? [] : worksFor(rel);
  photos.push({ id, ratio, hue: Math.round(hue), sat: +s.toFixed(3), lum: +l.toFixed(3), ...meta, src: rel, sha, ...(title ? { title } : {}), ...(works.length ? { works } : {}) });
}

writeFileSync(DATA, JSON.stringify(photos));
console.log(`✔ ${photos.length} fotos procesadas` + (dupes ? ` (${dupes} repetidas omitidas)` : ''));
