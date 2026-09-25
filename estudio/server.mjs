// Estudio: plataforma interna de mikeance.com (app local). Uso: node estudio/server.mjs  →  http://localhost:4455
// - Sirve la app (estudio/app), las fotos de la web (/public), el editor de Instagram (/catalogo) y ~/Desktop/RRSS (/RRSS).
// - El estado de la web es el mismo formato que los exports del catálogo: catalogo/estado-actual.json (publicado)
//   y catalogo/estudio/borrador.json (cambios sin publicar, se guarda solo).
// - «Nuevas»: fotos añadidas a ~/Desktop/FOTO después de crear la app (catalogo/estudio/base.json = lo que ya había).
// - Publicar: aplicar-seleccion → prepare-photos/faces/orden-auto → catalog → commit (public/photos, src/data)
//   → build en un worktree limpio → wrangler deploy → IndexNow.
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, createReadStream, unlinkSync, copyFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, extname, normalize, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FOTO = join(homedir(), 'Desktop/FOTO'), RRSS = join(homedir(), 'Desktop/RRSS');
const DIR = join(ROOT, 'catalogo/estudio'), CACHE = join(DIR, 'cache');
const PUBLICADO = join(ROOT, 'catalogo/estado-actual.json'), BORRADOR = join(DIR, 'borrador.json'), BASE = join(DIR, 'base.json'), META = join(DIR, 'meta.json');
const PORT = +process.env.PORT || 4455;
const VERSION = Math.floor(statSync(new URL(import.meta.url).pathname).mtimeMs / 1000);   // el lanzador reinicia el servidor si cambia este archivo
mkdirSync(CACHE, { recursive: true });
process.env.PATH = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', process.env.PATH].join(':');

const IMG = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic', '.heif']);
const load = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const huella = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const meta = load(META, {});   // ruta de FOTO → { r, sha }
let metaSucia = false;

// ---------- FOTO: todas las imágenes (sin _DUPLICADOS) ----------
function escanearFoto() {
  const out = [];
  (function walk(d, rel) {
    let names; try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      if (n.startsWith('.') || n.startsWith('._') || (!rel && n === '_DUPLICADOS')) continue;
      const p = join(d, n), r = rel ? rel + '/' + n : n;
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, r); else if (IMG.has(extname(n).toLowerCase())) out.push(r);
    }
  })(FOTO, '');
  return out;
}

// ---------- works: carpetas fotos/works/<NN NOMBRE>/[<NN COLECCIÓN>/] ----------
const slugify = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const folderInfo = (name) => { const m = name.match(/^(\d+)\s*[-._]?\s*(.+)$/); const n = (m ? m[2] : name).trim(); return { slug: slugify(n), name: n, order: m ? +m[1] : 999, folder: name }; };
const WORKS_DIR = join(ROOT, 'fotos/works');
const dirs = (d) => { try { return readdirSync(d).filter((n) => !n.startsWith('.') && statSync(join(d, n)).isDirectory()).sort(); } catch { return []; } };
function works() {
  return dirs(WORKS_DIR).map((d) => {
    const w = folderInfo(d);
    return { ...w, children: dirs(join(WORKS_DIR, d)).map((sd) => { const s = folderInfo(sd); return { ...s, slug: w.slug + '/' + s.slug }; }) };
  }).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

// Orden actual de la web para cada work y colección (igual que src/lib/works.ts), en rutas de FOTO:
// 'W:<slug>' = página (mosaico) y 'V:<slug>' = fila del hover.
function ordenWeb(web, fotoPorSha) {
  const byOrd = (a, b) => (a.ord ?? 0) - (b.ord ?? 0);
  const manual = (l, k) => l.filter((p) => p[k] !== undefined).sort((a, b) => a[k] - b[k]);
  const manualFirst = (l, k) => [...manual(l, k), ...l.filter((p) => p[k] === undefined)];
  const stripOf = (l, k) => { const m = manual(l, k); return m.length ? m : l; };
  const ws = new Map();
  for (const p of web) {
    if (p.cat !== 'work' || !p.work) continue;
    const w = ws.get(p.work) || ws.set(p.work, { secs: new Map(), loose: [] }).get(p.work);
    if (p.section) (w.secs.get(p.section) || w.secs.set(p.section, { order: p.sectionOrder ?? 999, photos: [] }).get(p.section)).photos.push(p); else w.loose.push(p);
  }
  const out = {}, rutas = (l) => [...new Set(l.map((p) => fotoPorSha[p.sha]).filter(Boolean))];
  for (const [slug, w] of ws) {
    const secs = [...w.secs.entries()].sort((a, b) => a[1].order - b[1].order);
    for (const [s, sec] of secs) { const ph = manualFirst(sec.photos.sort(byOrd), 'ordS'); out[`W:${slug}/${s}`] = rutas(ph); out[`V:${slug}/${s}`] = rutas(stripOf(ph, 'hovS')); sec.photos = ph; }
    const all = [...secs.flatMap(([, sec]) => sec.photos), ...w.loose.sort(byOrd)], ph = manualFirst(all, 'ordW');
    out['W:' + slug] = rutas(ph); out['V:' + slug] = rutas(stripOf(ph, 'hovW'));
  }
  return out;
}

// ---------- datos para la app ----------
function datos() {
  const publicado = load(PUBLICADO, null);
  if (!publicado) throw new Error('Falta catalogo/estado-actual.json');
  const borrador = load(BORRADOR, null);
  const estado = borrador?.estado || publicado;
  const web = load(join(ROOT, 'src/data/photos.json'), []);
  const origen = load(join(ROOT, 'fotos/origen.json'), {});
  const cache = load(join(ROOT, 'catalogo/cache.json'), {});
  const catalogo = load(join(ROOT, 'catalogo/catalogo.json'), {});

  // foto de FOTO → id de la web (webp en /public/photos)
  const webPorFoto = {}, webPorSha = {};
  for (const x of web) {
    if (!webPorSha[x.sha]) webPorSha[x.sha] = x;
    const p = origen[x.src]; if (p && !webPorFoto[p]) webPorFoto[p] = x;
  }
  const marcasDe = (e) => { const m = {}; for (const [k, v] of Object.entries(e.seleccion || {})) for (const p of v) m[p] = (m[p] || '') + k; return m; };
  const mE = marcasDe(estado), mP = marcasDe(publicado);
  const conocidas = new Set([...Object.keys(mE), ...Object.keys(mP), ...(estado.descartadas || []), ...(publicado.descartadas || [])]);

  // «Nuevas»: lo que se ha añadido a FOTO después de crear la app
  const todas = escanearFoto();
  let base = load(BASE, null);
  if (!base) { base = todas; writeFileSync(BASE, JSON.stringify(base)); }
  const enBase = new Set(base);
  const nuevas = todas.filter((p) => !enBase.has(p) && !conocidas.has(p) && !(estado.descartadas || []).includes(p));

  const lista = [...new Set([...Object.keys(mE), ...Object.keys(mP), ...nuevas])].filter((p) => !(estado.descartadas || []).includes(p) || mP[p]);
  const fotos = [];
  for (const p of lista) {
    let w = webPorFoto[p];
    if (!w && existsSync(join(FOTO, p))) {          // p. ej. fotos que solo están en works: por contenido
      const m = meta[p] ||= {}; if (!m.sha) { try { m.sha = huella(readFileSync(join(FOTO, p))); metaSucia = true; } catch {} }
      w = webPorSha[m.sha];
    }
    let r = w?.ratio;
    if (!r) { const c = cache[p]; if (c?.w && c?.h) r = c.w / c.h; }
    if (!r) r = meta[p]?.r;
    fotos.push({ p, id: w?.id || null, r: r ? +r.toFixed(4) : 0, sat: w?.sat, nueva: !mP[p] && !mE[p] ? 1 : 0 });
  }
  if (metaSucia) { writeFileSync(META, JSON.stringify(meta)); metaSucia = false; }
  const fotoPorSha = {}; for (const [p, x] of Object.entries(webPorFoto)) fotoPorSha[x.sha] ||= p;
  for (const f of fotos) { const m = meta[f.p]; if (m?.sha && !fotoPorSha[m.sha]) fotoPorSha[m.sha] = f.p; }
  return {
    baseActual: huella(JSON.stringify(publicado)),
    publicado, estado, borrador: borrador ? { guardado: borrador.guardado, base: borrador.base, baseActual: huella(JSON.stringify(publicado)) } : null,
    fotos, works: works(), ordenAuto: catalogo.ordenAuto || {}, ordenWeb: ordenWeb(web, fotoPorSha), nuevas: nuevas.length,
  };
}

// proporción de las fotos que aún no tienen datos (nuevas en FOTO): se calcula al pedirlas
async function completarProporciones(d) {
  const falta = d.fotos.filter((f) => !f.r);
  await Promise.all(falta.map(async (f) => {
    try { const m = await sharp(join(FOTO, f.p), { failOn: 'none', limitInputPixels: false }).metadata(); const rot = (m.orientation || 1) >= 5; const r = rot ? m.height / m.width : m.width / m.height; f.r = +r.toFixed(4); (meta[f.p] ||= {}).r = f.r; metaSucia = true; } catch { f.r = 0.67; }
  }));
  if (metaSucia) { writeFileSync(META, JSON.stringify(meta)); metaSucia = false; }
}

// ---------- miniaturas de fotos que aún no están en la web ----------
const enCurso = new Map();
async function miniatura(p, w) {
  const out = join(CACHE, huella(p + '|' + w) + '.jpg');
  if (existsSync(out)) return out;
  if (!enCurso.has(out)) enCurso.set(out, sharp(join(FOTO, p), { failOn: 'none', limitInputPixels: false }).rotate().resize(w, w, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(out).finally(() => enCurso.delete(out)));
  await enCurso.get(out);
  return out;
}

// ---------- publicar ----------
let job = null;   // { estado: 'corriendo'|'ok'|'error', pasos: [{t, estado}], log: [], error }
function ejecutar(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    job.log.push(`$ ${cmd} ${args.join(' ')}`);
    const ch = spawn(cmd, args, { cwd: opts.cwd || ROOT, env: process.env });
    const add = (b) => { for (const l of String(b).split('\n')) if (l.trim()) { job.log.push(l.replace(/\x1b\[[0-9;]*m/g, '')); if (job.log.length > 3000) job.log.shift(); } };
    ch.stdout.on('data', add); ch.stderr.on('data', add);
    ch.on('close', (c) => (c === 0 || opts.okCodes?.includes(c) ? res(c) : rej(new Error(`${basename(cmd)} ${args[0] || ''} terminó con error ${c}`))));
    ch.on('error', rej);
  });
}
async function publicar(resumen) {
  const borrador = load(BORRADOR, null);
  if (!borrador) throw new Error('No hay cambios que publicar');
  const pasos = [
    ['Colocando las fotos', async () => {
      const f = join(DIR, 'publicando.json');
      writeFileSync(f, JSON.stringify({ ...borrador.estado, exportado: new Date().toISOString() }));
      await ejecutar('python3', ['scripts/aplicar-seleccion.py', f, '--no-ocultar', '--previo', PUBLICADO]);
    }],
    ['Preparando las imágenes', async () => {
      await ejecutar('node', ['scripts/prepare-photos.mjs']);
      await ejecutar('node', ['scripts/faces.mjs']);
      await ejecutar('node', ['scripts/orden-auto.mjs']);
    }],
    ['Actualizando el catálogo', async () => {
      await ejecutar('node', ['scripts/catalog.mjs']);
      if (existsSync(join(ROOT, 'scripts/instagram-datos.py'))) await ejecutar('python3', ['scripts/instagram-datos.py']).catch((e) => job.log.push('(Instagram: ' + e.message + ')'));
    }],
    ['Guardando la versión', async () => {
      await ejecutar('git', ['add', '-A', '--', 'public/photos', 'src/data']);
      const hay = await ejecutar('git', ['diff', '--cached', '--quiet'], { okCodes: [1] });
      if (hay === 1) {
        await ejecutar('git', ['-c', 'user.name=Miguel Antón', '-c', 'user.email=miguel@scrapworld.es', 'commit', '-q', '-m', 'Estudio: ' + (resumen || 'cambios en la web')]);
        await ejecutar('git', ['push', '-q', 'origin', 'main']).catch(async () => { await new Promise((r) => setTimeout(r, 20000)); await ejecutar('git', ['push', '-q', 'origin', 'main']); });
      } else job.log.push('(sin cambios en los datos de la web)');
    }],
    ['Publicando en mikeance.com', async () => {
      const wt = join(tmpdir(), 'estudio-build');
      rmSync(wt, { recursive: true, force: true });
      await ejecutar('git', ['worktree', 'prune']);
      await ejecutar('git', ['worktree', 'add', '-q', '--detach', wt, 'HEAD']);
      try {
        symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'));
        await ejecutar('npx', ['astro', 'build'], { cwd: wt });
        await ejecutar('npx', ['wrangler', 'deploy'], { cwd: wt }).catch(async () => { job.log.push('(reintento de la publicación)'); await ejecutar('npx', ['wrangler', 'deploy'], { cwd: wt }); });
      } finally {
        await ejecutar('git', ['worktree', 'remove', '--force', wt]).catch(() => {});
      }
    }],
    ['Avisando a los buscadores', async () => { await ejecutar('node', ['scripts/indexnow.mjs']).catch((e) => job.log.push('(IndexNow: ' + e.message + ')')); }],
  ];
  job.pasos = pasos.map(([t]) => ({ t, estado: 'pendiente' }));
  for (const [i, [, fn]] of pasos.entries()) {
    job.pasos[i].estado = 'corriendo';
    await fn();
    job.pasos[i].estado = 'ok';
  }
  copyFileSync(join(DIR, 'publicando.json'), PUBLICADO);
  unlinkSync(BORRADOR);
}

// ---------- HTTP ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };
function servir(res, file, cache = false) {
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end('no existe'); }
  res.writeHead(200, { 'content-type': TIPOS[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cache ? 'max-age=86400' : 'no-cache' });
  createReadStream(file).pipe(res);
}
const dentro = (base, rel) => { const f = normalize(join(base, rel)); return f.startsWith(base + '/') ? f : null; };
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const cuerpo = (req) => new Promise((r, j) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch (e) { j(e); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const path = decodeURIComponent(url.pathname);
  try {
    if (path === '/api/ping') {   // v: versión del servidor (el lanzador lo reinicia si cambia); app: la de las pantallas (la app avisa para recargar)
      const app = Math.max(VERSION, ...readdirSync(join(ROOT, 'estudio/app')).map((n) => Math.floor(statSync(join(ROOT, 'estudio/app', n)).mtimeMs / 1000)));
      return json(res, { ok: 1, v: VERSION, app });
    }
    if (path === '/api/datos') { const d = datos(); await completarProporciones(d); return json(res, d); }
    if (path === '/api/estado' && req.method === 'PUT') {
      const b = await cuerpo(req);
      writeFileSync(BORRADOR, JSON.stringify({ guardado: new Date().toISOString(), base: b.base, estado: b.estado }));
      return json(res, { ok: 1 });
    }
    if (path === '/api/estado' && req.method === 'DELETE') { if (existsSync(BORRADOR)) unlinkSync(BORRADOR); return json(res, { ok: 1 }); }
    if (path === '/api/publicar' && req.method === 'POST') {
      if (job?.estado === 'corriendo') return json(res, { error: 'Ya se está publicando' }, 409);
      const b = await cuerpo(req);
      job = { estado: 'corriendo', pasos: [], log: [], inicio: Date.now() };
      publicar(b.resumen).then(() => { job.estado = 'ok'; job.fin = Date.now(); }, (e) => { job.estado = 'error'; job.error = e.message; job.log.push('ERROR: ' + e.message); const p = job.pasos.find((x) => x.estado === 'corriendo'); if (p) p.estado = 'error'; });
      return json(res, { ok: 1 });
    }
    if (path === '/api/publicar') return json(res, job || { estado: 'nada' });
    if (path === '/api/work' && req.method === 'POST') {   // nuevo work o colección: fotos/works/<NN NOMBRE>[/<NN COLECCIÓN>]
      const { nombre, padre } = await cuerpo(req);
      const limpio = String(nombre || '').replace(/[\/:]/g, '-').trim().toUpperCase(); if (!limpio) return json(res, { error: 'Falta el nombre' }, 400);
      const ws = works(); const w = padre ? ws.find((x) => x.slug === padre) : null;
      if (padre && !w) return json(res, { error: 'No existe el work' }, 400);
      const hermanos = w ? w.children : ws, n = Math.max(0, ...hermanos.map((x) => (x.order === 999 ? 0 : x.order))) + 1;
      const carpeta = `${String(n).padStart(2, '0')} ${limpio}`;
      mkdirSync(w ? join(WORKS_DIR, w.folder, carpeta) : join(WORKS_DIR, carpeta), { recursive: true });
      return json(res, { ok: 1, slug: (w ? w.slug + '/' : '') + slugify(limpio), works: works() });
    }
    if (path === '/api/finder' && req.method === 'POST') { const { p } = await cuerpo(req); const f = dentro(FOTO, p); if (f && existsSync(f)) spawn('open', ['-R', f]); return json(res, { ok: 1 }); }
    if (path === '/foto') {        // miniatura de una foto de FOTO que aún no está en la web
      const p = url.searchParams.get('p') || '', w = Math.min(1600, Math.max(200, +url.searchParams.get('w') || 400));
      if (!dentro(FOTO, p)) { res.writeHead(400); return res.end(); }
      return servir(res, await miniatura(p, w), true);
    }
    if (path === '/' || path === '/index.html') return servir(res, join(ROOT, 'estudio/app/index.html'));
    for (const [pre, base, cache] of [['/app/', join(ROOT, 'estudio/app'), false], ['/public/', join(ROOT, 'public'), true], ['/catalogo/', join(ROOT, 'catalogo'), false], ['/RRSS/', RRSS, true], ['/src/lib/', join(ROOT, 'src/lib'), false]]) {
      if (path.startsWith(pre)) { const f = dentro(base, path.slice(pre.length)); if (f) return servir(res, f, cache); }
    }
    res.writeHead(404); res.end('no existe');
  } catch (e) {
    console.error(e); json(res, { error: e.message }, 500);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Estudio en http://localhost:${PORT}`));
