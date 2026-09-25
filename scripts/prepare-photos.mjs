// Optimiza las fotos de /fotos y genera src/data/photos.json
//   fotos/portrait | editorial | lifestyle      -> Fotografía
//   fotos/portada                                -> Portada (orden manual)
//   fotos/works/<NN NOMBRE>/                    -> Works (el número ordena la lista; el nombre es el título; las fotos, por nombre de archivo)
//   fotos/works/<NN NOMBRE>/<NN SECCIÓN>/       -> secciones (colecciones) dentro de un work, en ese orden
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
const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const workFolders = existsSync(join(SRC, 'works')) ? readdirSync(join(SRC, 'works')).filter((n) => !n.startsWith('.') && statSync(join(SRC, 'works', n)).isDirectory()).sort() : [];
const workInfo = (folder) => { const m = folder.match(/^(\d+)\s*[-._]?\s*(.+)$/); const name = (m ? m[2] : folder).trim(); return { work: slugify(name), workName: name, workOrder: m ? +m[1] : 999 }; };
const EXT = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);

// En Cloudflare no existen los originales (fotos/ no se sube): se usan las imágenes ya generadas en public/photos.
if (!existsSync(SRC)) { console.log('ℹ sin carpeta fotos/: se mantienen las imágenes ya generadas'); process.exit(0); }
mkdirSync(OUT, { recursive: true });
mkdirSync(join(ROOT, 'src/data'), { recursive: true });
// Títulos: fotos/titulos.json  { "faces/Proyecto/archivo.jpg": "Nombre · Lugar · 2024" }
// Orden manual por categoría: fotos/orden.json { "faces": ["faces/Sesión/foto.jpg", ...], "lifestyle": [...] }
const orden = existsSync(join(SRC, 'orden.json')) ? JSON.parse(readFileSync(join(SRC, 'orden.json'), 'utf8')) : {};
const ordIdx = {}; for (const [c, list] of Object.entries(orden)) list.forEach((rel, i) => { ordIdx[rel] = i; });
// Orden manual de WORKS (editor del catálogo): fotos/orden-works.json { "scrapworld": [rutas], "scrapworld/spring22": [rutas], "kangol": [...] }
//   clave sin "/" -> ordW (hover general del work y mosaico si no tiene colecciones); clave "work/colección" -> ordS (esa colección)
const ordenW = existsSync(join(SRC, 'orden-works.json')) ? JSON.parse(readFileSync(join(SRC, 'orden-works.json'), 'utf8')) : {};
const ordW = {}, ordS = {}; for (const [k, list] of Object.entries(ordenW)) list.forEach((rel, i) => { (k.includes('/') ? ordS : ordW)[rel] = i; });
// Fila del hover de cada work / colección (independiente del orden de la página): fotos/orden-hovers.json, misma forma -> hovW / hovS
const ordenH = existsSync(join(SRC, 'orden-hovers.json')) ? JSON.parse(readFileSync(join(SRC, 'orden-hovers.json'), 'utf8')) : {};
const hovW = {}, hovS = {}; for (const [k, list] of Object.entries(ordenH)) list.forEach((rel, i) => { (k.includes('/') ? hovS : hovW)[rel] = i; });
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
  if (a === 'works' && b && workFolders.includes(b)) {
    const inWork = relative(join(SRC, 'works', b), file).split('/');
    if (inWork.length === 1) { const files = readdirSync(join(SRC, 'works', b)).filter((n) => EXT.has(extname(n).toLowerCase())).sort(); return { cat: 'work', ...workInfo(b), ord: files.indexOf(inWork[0]) }; }
    const sub = inWork[0], si = workInfo(sub);
    const files = readdirSync(join(SRC, 'works', b, sub)).filter((n) => EXT.has(extname(n).toLowerCase())).sort();
    return { cat: 'work', ...workInfo(b), section: si.work, sectionName: si.workName, sectionOrder: si.workOrder, ord: files.indexOf(inWork[1]) };
  }
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
const idBySha = new Map();
let dupes = 0;
for (const file of walk(SRC)) {
  const meta = classify(file);
  if (!meta) continue;
  // Misma foto (mismo contenido) dentro de la misma categoría/proyecto: solo una vez.
  const sha = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12);
  const key = (meta.work || meta.cat) + ':' + sha;
  if (seenContent.has(key)) { dupes++; continue; }
  seenContent.add(key);
  // Misma foto en varias carpetas: se reutiliza la imagen ya generada (id por contenido)
  const id = idBySha.get(sha) ?? createHash('sha1').update(relative(SRC, file)).digest('hex').slice(0, 10);
  idBySha.set(sha, id);
  const small = join(OUT, `${id}-800.webp`);
  const large = join(OUT, `${id}-1600.webp`);
  const tiny = join(OUT, `${id}-400.webp`);   // 400 px de ancho: móvil y miniaturas (srcset)
  const base = sharp(file, { failOn: 'none' }).rotate();
  const info = await base.clone().metadata();
  const rotated = info.orientation && info.orientation >= 5;
  const w = rotated ? info.height : info.width;
  const h = rotated ? info.width : info.height;
  if (!existsSync(large)) await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(large);
  if (!existsSync(small)) await base.clone().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(small);
  if (!existsSync(tiny)) await base.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 76 }).toFile(tiny);   // 400 px de ancho
  const { data } = await sharp(small).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // Croma medio por píxel (32×32): ~0 en blanco y negro, alto en fotos de color (para filtrar B/N en el catálogo)
  const { data: d32 } = await sharp(small).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let chSum = 0; for (let i = 0; i < d32.length; i += 3) chSum += Math.max(d32[i], d32[i + 1], d32[i + 2]) - Math.min(d32[i], d32[i + 1], d32[i + 2]);
  const chroma = +(chSum / (d32.length / 3) / 255).toFixed(3);
  let r = 0, g = 0, b = 0, lb = 0;
  for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; if (i >= data.length * 0.75) lb += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255; }
  const lumBottom = +(lb / (data.length / 3 / 4)).toFixed(3); // luz media del cuarto inferior
  const n = data.length / 3;
  const { h: hue, s, l } = rgbToHsl(r / n, g / n, b / n);
  const ratio = +(w / h).toFixed(4);
  const rel = relative(SRC, file);
  const title = titles[rel] || '';
  photos.push({ id, ratio, hue: Math.round(hue), sat: +s.toFixed(3), chroma, lum: +l.toFixed(3), lumB: lumBottom, ...meta, src: rel, sha, ...(title ? { title } : {}), ...(rel in ordIdx ? { ord: ordIdx[rel] } : {}), ...(rel in ordW ? { ordW: ordW[rel] } : {}), ...(rel in ordS ? { ordS: ordS[rel] } : {}), ...(rel in hovW ? { hovW: hovW[rel] } : {}), ...(rel in hovS ? { hovS: hovS[rel] } : {}) });
}

writeFileSync(DATA, JSON.stringify(photos));
console.log(`✔ ${photos.length} fotos procesadas` + (dupes ? ` (${dupes} repetidas omitidas)` : ''));
