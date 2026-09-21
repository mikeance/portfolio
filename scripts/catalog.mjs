// Cataloga TODO lo que hay en la carpeta de fotos (sin descartar nada) y genera catalogo/index.html
// Uso: npm run catalogo            (usa FOTO_DIR o ~/Desktop/FOTO)
//      FOTO_DIR=/otra/ruta npm run catalogo
// Es incremental: solo analiza los archivos nuevos (caché en catalogo/cache.json).
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readdirSync, statSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { homedir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const FOTO = process.env.FOTO_DIR || join(homedir(), 'Desktop/FOTO');
const OUT = join(ROOT, 'catalogo');
const THUMBS = join(OUT, 'thumbs');
mkdirSync(THUMBS, { recursive: true });

const IMG = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic', '.heif']);
const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const cache = load(join(OUT, 'cache.json'), {});
const pre = load(join(OUT, 'preseleccion.json'), {});
const hidden = new Set(load(join(OUT, 'ocultas.json'), [])); // fotos que no se muestran en el catálogo (los archivos no se tocan)

// 1) recorrer todo
const files = [];
(function walk(d) {
  for (const n of readdirSync(d).sort()) {
    if (n === '.DS_Store' || n.startsWith('._')) continue;
    const p = join(d, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push({ path: relative(FOTO, p), size: st.size, ext: extname(n).toLowerCase() });
  }
})(FOTO);

const isDup = (f) => f.path.startsWith('_DUPLICADOS/');
const images = files.filter((f) => IMG.has(f.ext) && !isDup(f));
const dupFiles = files.filter(isDup);
const others = files.filter((f) => !IMG.has(f.ext) && !isDup(f));
console.log(`archivos: ${files.length} · imágenes: ${images.length} · en _DUPLICADOS: ${dupFiles.length} · otros: ${others.length}`);

// 2) analizar solo lo nuevo
const idOf = (p) => createHash('sha1').update(p).digest('hex').slice(0, 10);
async function analyse(f) {
  const id = idOf(f.path);
  const full = join(FOTO, f.path);
  try {
    const img = sharp(full, { failOn: 'none', limitInputPixels: false }).rotate();
    const meta = await sharp(full, { failOn: 'none', limitInputPixels: false }).metadata();
    const rot = meta.orientation && meta.orientation >= 5;
    const w = rot ? meta.height : meta.width, h = rot ? meta.width : meta.height;
    await img.clone().resize(240, 240, { fit: 'inside' }).jpeg({ quality: 70 }).toFile(join(THUMBS, id + '.jpg'));
    const { data, info } = await img.clone().greyscale().resize(256, 256, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    let sum = 0; for (const v of data) sum += v;
    let m = 0, m2 = 0, n = 0;
    for (let y = 1; y < info.height - 1; y++) for (let x = 1; x < info.width - 1; x++) {
      const c = data[y * info.width + x];
      const l = 4 * c - data[y * info.width + x - 1] - data[y * info.width + x + 1] - data[(y - 1) * info.width + x] - data[(y + 1) * info.width + x];
      m += l; m2 += l * l; n++;
    }
    const d = await img.clone().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    let hash = '';
    for (let y = 0; y < 8; y++) { let b = 0; for (let x = 0; x < 8; x++) b = (b << 1) | (d[y * 9 + x] > d[y * 9 + x + 1] ? 1 : 0); hash += b.toString(16).padStart(2, '0'); }
    return { id, path: f.path, w, h, lum: +(sum / data.length / 255).toFixed(3), sharp: +(m2 / n - (m / n) ** 2).toFixed(1), hash };
  } catch (e) {
    return { id, path: f.path, error: String(e.message).slice(0, 100) };
  }
}
const todo = images.filter((f) => !cache[f.path] || (cache[f.path].size && cache[f.path].size !== f.size));
console.log(`nuevas por analizar: ${todo.length}`);
let next = 0, done = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < todo.length) {
    const f = todo[next++];
    cache[f.path] = await analyse(f);
    if (++done % 250 === 0) console.log(`  ${done}/${todo.length}`);
  }
}));
for (const f of images) if (cache[f.path]) cache[f.path].size = f.size;
writeFileSync(join(OUT, 'cache.json'), JSON.stringify(cache));

// 3) marcas: baja resolución, oscura, clara, borrosa, casi-duplicada (dentro de la misma carpeta)
const ok = images.map((f) => cache[f.path]).filter((o) => o && !o.error);
const sh = ok.map((o) => o.sharp).sort((a, b) => a - b);
const p10 = sh[Math.floor(sh.length * 0.1)] ?? 0;
const ham = (a, b) => { let d = 0; for (let k = 0; k < a.length; k += 2) { let x = parseInt(a.slice(k, k + 2), 16) ^ parseInt(b.slice(k, k + 2), 16); while (x) { d += x & 1; x >>= 1; } } return d; };
const sorted = [...ok].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
const dirOf = (p) => p.slice(0, p.lastIndexOf('/'));
const similar = new Set();
for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < Math.min(sorted.length, i + 10); j++) {
  if (dirOf(sorted[i].path) !== dirOf(sorted[j].path)) continue;
  if (ham(sorted[i].hash, sorted[j].hash) <= 5) { similar.add(sorted[i].path); similar.add(sorted[j].path); }
}
const photos = images.filter((f) => !hidden.has(f.path)).map((f) => {
  const o = cache[f.path];
  if (!o || o.error) return { id: idOf(f.path), p: f.path, err: o?.error || 'sin analizar' };
  const fl = [];
  if (Math.max(o.w, o.h) < 1200) fl.push('baja');
  if (o.lum < 0.06) fl.push('oscura');
  if (o.lum > 0.94) fl.push('clara');
  if (o.sharp < p10) fl.push('borrosa');
  if (similar.has(f.path)) fl.push('similar');
  return { id: o.id, p: f.path, w: o.w, h: o.h, f: fl, s: pre[f.path] || '' };
});

const summary = {
  generado: new Date().toISOString(), carpeta: FOTO, imagenes: images.length, ocultas: hidden.size,
  duplicados_en_carpeta: dupFiles.length, otros_archivos: others.map((f) => f.path), con_error: photos.filter((p) => p.err).map((p) => [p.p, p.err]),
};
writeFileSync(join(OUT, 'catalogo.json'), JSON.stringify({ ...summary, photos }, null, 1));
writeFileSync(join(OUT, 'catalog-data.js'), `window.CATALOG=${JSON.stringify({ base: 'file://' + FOTO + '/', ...summary, photos })};`);
console.log(`✔ catálogo: ${photos.length} fotos · ${photos.filter((p) => p.err).length} con error · ${others.length} otros archivos · ${dupFiles.length} en _DUPLICADOS`);
