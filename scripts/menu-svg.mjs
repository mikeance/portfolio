// Genera src/data/menu.json a partir de "menu web.svg":
//   columna izquierda = palabras en reposo; columna derecha = las mismas letras "descolocadas".
// Para cada letra se calcula la transformación (giro + desplazamiento + escala) que la lleva de
// la pose de reposo a la descolocada, y la web la anima con CSS al pasar el cursor.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const svg = readFileSync(join(ROOT, 'menu web.svg'), 'utf8');
const groups = [...svg.matchAll(/<g>([\s\S]*?)<\/g>/g)].map((m) => [...m[1].matchAll(/<path[^>]*d="([^"]+)"/g)].map((p) => p[1]));
const WORDS = [
  { key: 'editorial', n: 9 }, { key: 'faces', n: 5 }, { key: 'lifestyle', n: 4 }, { key: 'works', n: 5 }, { key: 'contact', n: 7 },
];

// --- parser de rutas: devuelve los puntos de anclaje (fin de cada segmento) en coordenadas absolutas
function anchors(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pts = []; let cmd = '', x = 0, y = 0, sx = 0, sy = 0, i = 0;
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(); const C = cmd.toUpperCase();
    if (C === 'Z') { x = sx; y = sy; if (i < toks.length && !/[a-zA-Z]/.test(toks[i])) cmd = rel ? 'l' : 'L'; continue; }
    if (C === 'M' || C === 'L' || C === 'T') { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; } pts.push([x, y]); continue; }
    if (C === 'H') { const nx = num(); x = rel ? x + nx : nx; pts.push([x, y]); continue; }
    if (C === 'V') { const ny = num(); y = rel ? y + ny : ny; pts.push([x, y]); continue; }
    if (C === 'C') { num(); num(); num(); num(); const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pts.push([x, y]); continue; }
    if (C === 'S' || C === 'Q') { num(); num(); const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pts.push([x, y]); continue; }
    if (C === 'A') { num(); num(); num(); num(); num(); const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; pts.push([x, y]); continue; }
    throw new Error('comando no soportado: ' + cmd);
  }
  return pts;
}
const bbox = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);

// --- similitud (giro+escala+traslación) por mínimos cuadrados entre dos listas de puntos emparejados
function similarity(P, Q) {
  const pc = centroid(P), qc = centroid(Q);
  let sr = 0, si = 0, den = 0;
  for (let k = 0; k < P.length; k++) {
    const zx = P[k][0] - pc[0], zy = P[k][1] - pc[1], wx = Q[k][0] - qc[0], wy = Q[k][1] - qc[1];
    sr += zx * wx + zy * wy; si += zx * wy - zy * wx; den += zx * zx + zy * zy;
  }
  const a = sr / den, b = si / den; // matriz [a -b; b a]
  return [a, b, -b, a, qc[0] - (a * pc[0] - b * pc[1]), qc[1] - (b * pc[0] + a * pc[1])];
}

const left = groups[0], right = groups.slice(1);
if (left.length !== 30 || right.length !== 5) throw new Error(`estructura inesperada: ${left.length} letras, ${right.length} palabras`);
const out = []; let li = 0;
WORDS.forEach((w, wi) => {
  const letters = [];
  for (let k = 0; k < w.n; k++) {
    const d0 = left[li++], d1 = right[wi][k];
    const P = anchors(d0), Q = anchors(d1);
    let m;
    if (P.length === Q.length) m = similarity(P, Q);
    else { const b0 = bbox(P), b1 = bbox(Q); m = [1, 0, 0, 1, (b1[0] + b1[2] - b0[0] - b0[2]) / 2, (b1[1] + b1[3] - b0[1] - b0[3]) / 2]; console.warn(`  ${w.key}[${k}]: anclas distintas (${P.length} vs ${Q.length}); solo desplazamiento`); }
    letters.push({ d: d0, m: m.map((v) => +v.toFixed(3)), bb: bbox(P).map((v) => +v.toFixed(1)), bb1: bbox(Q).map((v) => +v.toFixed(1)) });
  }
  const all = letters.flatMap((l) => l.bb), all1 = letters.flatMap((l) => l.bb1);
  const x0 = Math.min(...letters.map((l) => l.bb[0])), y0 = Math.min(...letters.map((l) => l.bb[1]));
  const x1 = Math.max(...letters.map((l) => l.bb[2])), y1 = Math.max(...letters.map((l) => l.bb[3]));
  const rot = (l) => Math.round(Math.atan2(l.m[1], l.m[0]) * 180 / Math.PI);
  // La primera letra (sin giro) fija la posición de la palabra: las demás se mueven respecto a ella.
  const [dx0, dy0] = [letters[0].m[4], letters[0].m[5]];
  const PAD = 6, vb = [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD].map((v) => +v.toFixed(1));
  // El navegador aplica el transform CSS con origen en el (0,0) del espacio de usuario: la matriz vale tal cual.
  for (const l of letters) { const [a, b, c, d, e, f] = l.m; l.m = [a, b, c, d, e - dx0, f - dy0].map((v) => +v.toFixed(3)); }
  out.push({ key: w.key, vb, letters: letters.map(({ d, m }) => ({ d, m })) });
  console.log(`${w.key}: ${w.n} letras · reposo ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)} · giros ${letters.map(rot).join('/')}°`);
});
writeFileSync(join(ROOT, 'src/data/menu.json'), JSON.stringify(out));
console.log('✔ src/data/menu.json');
