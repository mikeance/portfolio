// Añade a src/data/photos.json el campo `face` (área de la cara mayor, 0–1) en las fotos de FACES,
// usando Vision de macOS sobre las imágenes ya generadas en public/photos. Caché en src/data/faces.json.
// Se ejecuta después de prepare-photos (npm run photos). Si no hay swift (p. ej. en Cloudflare) no hace nada.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = join(ROOT, 'src/data/photos.json');
const CACHE = join(ROOT, 'src/data/faces.json');
const photos = JSON.parse(readFileSync(DATA, 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// Binario compilado (Vision) en .cache/faces; se compila la primera vez si hay swiftc.
const BIN = join(ROOT, '.cache/faces');
let swift = existsSync(BIN);
if (!swift) { try { execFileSync('swiftc', ['-O', join(ROOT, 'scripts/faces.swift'), '-o', BIN], { stdio: 'ignore' }); swift = existsSync(BIN); } catch { swift = false; } }
const todo = photos.filter((p) => p.cat === 'faces' && !(p.id in cache) && existsSync(join(ROOT, 'public/photos', `${p.id}-800.webp`)));
if (swift && todo.length) {
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    const files = batch.map((p) => join(ROOT, 'public/photos', `${p.id}-800.webp`));
    const res = JSON.parse(execFileSync(BIN, files, { encoding: 'utf8', maxBuffer: 1e8 }));
    for (const p of batch) { const r = res[join(ROOT, 'public/photos', `${p.id}-800.webp`)]; if (r) cache[p.id] = { n: r.n, max: +r.max.toFixed(4) }; }
  }
  writeFileSync(CACHE, JSON.stringify(cache));
}
let n = 0;
for (const p of photos) if (p.cat === 'faces' && cache[p.id]) { p.face = cache[p.id].max; p.faces = cache[p.id].n; n++; }
writeFileSync(DATA, JSON.stringify(photos));
console.log(`✔ caras: ${n} fotos con datos` + (todo.length ? ` (${todo.length} analizadas ahora)` : '') + (swift ? '' : ' (sin swift: se mantiene la caché)'));
