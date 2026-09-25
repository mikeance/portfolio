// Aplica un export del editor de Instagram (catalogo/instagram.html → «Exportar plan»):
//   1. lo guarda como catalogo/instagram-plan.json (el plan que carga el editor)
//   2. regenera catalogo/instagram-data.js
//   3. regenera ~/Desktop/RRSS/carruseles: una carpeta por post, una imagen por diapositiva sacada de los originales
//      de fotos/ con borde blanco: 1080×1350 (4:5; los dípticos 'id1+id2' van una encima de otra) o 1080×720 en
//      los posts horizontales (formato 'h'), numeradas en orden de subida, y pie.txt con el texto.
//      Stories (catalogo/instagram-stories.js): en cada post, stories/ con las imágenes 1080×1920 y stories.txt;
//      la campaña de lanzamiento va en carpetas «000 fecha Stories · …»; la encuesta del sábado, en el post siguiente.
// Uso: node scripts/instagram-aplicar.mjs "~/Downloads/instagram-plan (N).json"
//      node scripts/instagram-aplicar.mjs            (solo regenera las carpetas con el plan actual)
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = join(ROOT, 'catalogo/instagram-plan.json');
const OUT = join(homedir(), 'Desktop/RRSS/carruseles');
const arg = process.argv[2]?.replace(/^~/, homedir());

if (arg) {
  const exp = JSON.parse(readFileSync(arg, 'utf8'));
  if (exp.tipo !== 'instagram-plan') throw new Error(`${arg} no es un export del editor de Instagram`);
  const plan = { inicio: exp.inicio, dias: exp.dias, ...(exp.campana ? { campana: exp.campana } : {}), origen: `export ${exp.exportado}`, posts: exp.posts.map(({ fecha, ...p }) => p) };
  writeFileSync(PLAN, JSON.stringify(plan, null, 1));
  console.log(`Plan aplicado: ${plan.posts.length} posts`);
}
execFileSync('python3', [join(ROOT, 'scripts/instagram-datos.py')], { stdio: 'inherit' });

// fechas igual que el editor
const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
const dias = new Set(plan.dias?.length ? plan.dias : [1, 3, 5]);
const d = new Date(`${plan.inicio}T12:00:00`);
const fechas = plan.posts.map((_, i) => { if (i) do d.setDate(d.getDate() + 1); while (!dias.has(d.getDay())); return d.toISOString().slice(0, 10); });

const src = new Map();
for (const p of JSON.parse(readFileSync(join(ROOT, 'src/data/photos.json'), 'utf8'))) if (!src.has(p.id)) src.set(p.id, p.src);

// Borra solo las carpetas generadas por este script («NNN AAAA-MM-DD …»)
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/^\d{2,3} \d{4}-\d\d-\d\d /.test(f)) rmSync(join(OUT, f), { recursive: true });

let n = 0;
for (const [k, p] of plan.posts.entries()) {
  if (!p.fotos.length) continue;
  const dir = join(OUT, `${String(k + 1).padStart(3, '0')} ${fechas[k]} ${p.titulo.replace(/[/:]/g, '-')}`);
  mkdirSync(dir, { recursive: true });
  const h = p.formato === 'h';
  const W = 1080, H = h ? 720 : 1350, MX = h ? 30 : 40, MY = h ? 20 : 50, GAP = 40;
  const ok = it => it.split('+').filter(id => src.has(id)).join('+');   // fotos que ya no están en la web: fuera
  const slides = (h ? p.fotos.flatMap(it => it.split('+')) : p.fotos).map(ok).filter(Boolean);   // en 3:2 no hay dípticos
  for (const id of p.fotos.flatMap(it => it.split('+')).filter(id => !src.has(id))) console.warn(`«${p.titulo}»: ${id} ya no está en la web, se omite`);
  for (const [j, it] of slides.entries()) {
    const ids = it.split('+');
    const boxH = (H - 2 * MY - GAP * (ids.length - 1)) / ids.length;
    const bufs = await Promise.all(ids.map(async id => {
      const file = join(ROOT, 'fotos', src.get(id) || '');
      const input = existsSync(file) ? file : join(ROOT, 'public/photos', `${id}-1600.webp`);
      return sharp(input).rotate().resize(W - 2 * MX, Math.floor(boxH), { fit: 'inside' }).toBuffer({ resolveWithObject: true });
    }));
    const total = bufs.reduce((a, b) => a + b.info.height, 0) + GAP * (bufs.length - 1);
    let y = Math.round((H - total) / 2);
    const layers = bufs.map(b => { const l = { input: b.data, left: Math.round((W - b.info.width) / 2), top: y }; y += b.info.height + GAP; return l; });
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite(layers).jpeg({ quality: 92, mozjpeg: true })
      .toFile(join(dir, `${String(j + 1).padStart(2, '0')}.jpg`));
    n += ids.length;
  }
  writeFileSync(join(dir, 'pie.txt'), [p.pie, '', p.etiquetas && `Etiquetar: ${p.etiquetas}`, p.nota && `Nota: ${p.nota}`].filter(x => x !== undefined && x !== '').join('\n') + '\n');
}
console.log(`${OUT}: ${plan.posts.length} carpetas, ${n} fotos`);

// ---- stories ----
await import(pathToFileURL(join(ROOT, 'catalogo/instagram-stories.js')).href);
const IG = JSON.parse(readFileSync(join(ROOT, 'catalogo/instagram-data.js'), 'utf8').replace(/^window\.IG=/, '').replace(/;\s*$/, ''));
const F = new Map(IG.fotos.map(f => [f.id, f]));
const BORDES = existsSync(join(ROOT, 'catalogo/instagram-bordes.json')) ? JSON.parse(readFileSync(join(ROOT, 'catalogo/instagram-bordes.json'), 'utf8')) : {};
const input = id => { const file = join(ROOT, 'fotos', src.get(id) || ''); return existsSync(file) ? file : join(ROOT, 'public/photos', `${id}-1600.webp`); };
const SW = 1080, SH = 1920;
async function storyImg(it, file) {
  const bg = { create: { width: SW, height: SH, channels: 3, background: '#ffffff' } };
  if (it.fotos) {  // encuesta: dos fotos, hueco en medio para el sticker
    const bufs = await Promise.all(it.fotos.map(id => sharp(input(id)).rotate().resize(1000, 820, { fit: 'inside' }).toBuffer({ resolveWithObject: true })));
    const cy = [470, 1420];
    return sharp(bg).composite(bufs.map((b, k) => ({ input: b.data, left: Math.round((SW - b.info.width) / 2), top: Math.round(cy[k] - b.info.height / 2) }))).jpeg({ quality: 90 }).toFile(file);
  }
  if (it.detalle) {  // detalle: el centro de la foto (sin el marco de película) a sangre
    const m = await sharp(input(it.foto)).rotate().metadata();
    const w = m.orientation >= 5 ? m.height : m.width, h = m.orientation >= 5 ? m.width : m.height;
    const [l, t, r, b] = BORDES[it.foto] || [0, 0, 1, 1];
    const cw = (r - l) * w, ch = (b - t) * h, dw = cw * 0.5, dh = Math.min(ch * 0.5, dw * 16 / 9) , dw2 = dh * 9 / 16;
    const left = Math.round(l * w + (cw - dw2) / 2), top = Math.round(t * h + (ch - dh) / 2);
    const buf = await sharp(input(it.foto)).rotate().toBuffer();
    return sharp(buf).extract({ left, top, width: Math.round(dw2), height: Math.round(dh) }).resize(SW, SH, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(file);
  }
  const b = await sharp(input(it.foto)).rotate().resize(1000, 1400, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  return sharp(bg).composite([{ input: b.data, left: Math.round((SW - b.info.width) / 2), top: Math.round(860 - b.info.height / 2) }]).jpeg({ quality: 90 }).toFile(file);
}
const cal = IGStories.calendario(plan, F, fechas);
const dirOf = k => join(OUT, readdirSync(OUT).find(f => f.startsWith(String(k + 1).padStart(3, '0') + ' ')));
let ns = 0;
for (const d of cal) {
  let dir, pre = '';
  if (d.ref.c != null) { dir = join(OUT, `000 ${d.fecha} Stories · ${d.titulo}`); }
  else if (d.ref.p != null) { if (!plan.posts[d.ref.p].fotos.length) continue; dir = join(dirOf(d.ref.p), 'stories'); }
  else { if (!plan.posts[d.ref.e].fotos.length) continue; dir = join(dirOf(d.ref.e), 'stories'); pre = 'encuesta-'; }
  mkdirSync(dir, { recursive: true });
  const lines = [];
  for (const [k, it] of d.items.entries()) {
    const name = `${pre}${String(k + 1).padStart(2, '0')}.jpg`;
    const has = (it.fotos || [it.foto]).every(id => id && F.has(id));
    if (has) { await storyImg(it, join(dir, name)); ns++; }
    lines.push(`${pre ? 'Sábado ' + d.fecha + ' · ' : ''}${k + 1}. ${has ? name : '(sin imagen)'} — ${it.txt || ''}`);
  }
  const txt = join(dir, 'stories.txt');
  writeFileSync(txt, (existsSync(txt) ? readFileSync(txt, 'utf8') + '\n' : (d.ref.e != null ? `${fechas[d.ref.e]} · ${plan.posts[d.ref.e].titulo}` : `${d.fecha} · ${d.titulo}`) + '\n\n') + lines.join('\n') + '\n');
}
console.log(`Stories: ${cal.length} días, ${ns} imágenes`);
