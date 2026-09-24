// Amplía el contenido de una foto de negativo SIN tocar su marco (margen blanco del escaneo, banda negra y muescas).
// No se inventa nada: la zona visible nueva es un recorte de la propia foto, escalado.
// Uso: [CALIDAD=100] node scripts/retoque-ampliar.mjs <original> <salida> <zoom> <anclaX> <anclaY|"base">
//   ancla = punto que no se mueve (px del original); "base" = borde inferior de la imagen, dentro del marco.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [src, out, zArg, axArg, ayArg] = process.argv.slice(2);
const z = +zArg;
const img = sharp(src, { failOn: 'none' }).rotate();
const { data, info } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = 3;
const lum = (x, y) => { const i = (y * W + x) * C; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };

// Marco (máscara 2D): 1) desde el borde de la imagen, el margen claro del escaneo y las muescas (conectados al borde);
// 2) desde ahí, solo lo muy negro pegado a ellos (la banda del negativo), sin alejarse más de MAXB px del borde.
// Así las esquinas redondeadas se respetan y nada gris de la foto (micrófono, vallas) se confunde con el marco.
const MAXB = 170, DARK = 32, LIGHT = 120;
const frame = new Uint8Array(W * H);
const nearEdge = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y) < MAXB;
const flood = (seeds, ok) => {
  const st = seeds.slice();
  while (st.length) { const k = st.pop(), x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (frame[q] || !nearEdge(nx, ny) || !ok(nx, ny)) continue; frame[q] = 1; st.push(q); } }
};
const seeds = [];
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const k = y * W + x; if (!frame[k] && lum(x, y) >= LIGHT) { frame[k] = 1; seeds.push(k); } }
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const k = y * W + x; if (!frame[k] && lum(x, y) >= LIGHT) { frame[k] = 1; seeds.push(k); } }
flood(seeds, (x, y) => lum(x, y) >= LIGHT);                       // margen claro y muescas
// Banda negra del negativo: su borde interior se mide en cada columna/fila (desde el margen, atravesando lo negro).
// La medida solo es fiable donde lo que toca la banda es claro (cielo, césped); donde es oscuro (piernas, pelo de un
// micrófono, vallas) se toma el borde de los tramos vecinos. Cerca de las esquinas (curvas) se usa la medida directa.
const TH = {};
{
  const CORNER = 220, WIN = 60;
  const side = (len, at, name) => {            // at(i, k) = [x, y] del píxel a k px del borde en la posición i
    const r = new Int32Array(len), ok = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      let k = 0;
      while (k < MAXB) { const [x, y] = at(i, k); if (!frame[y * W + x]) break; k++; }
      while (k < MAXB) { const [x, y] = at(i, k); if (lum(x, y) >= DARK) break; k++; }
      r[i] = k;
      let sum = 0; for (let j = 0; j < 8; j++) { const [x, y] = at(i, Math.min(MAXB + 20, k + 2 + j)); sum += lum(x, y); }
      ok[i] = k < MAXB && sum / 8 >= 90 ? 1 : 0;
    }
    // curva suave (parábola) ajustada a las medidas fiables del tramo central, descartando las que se desvían
    const t = (i) => (2 * i) / (len - 1) - 1;
    let use = []; for (let i = CORNER; i < len - CORNER; i++) if (ok[i]) use.push(i);
    let c = [0, 0, 0];
    for (let it = 0; it < 4 && use.length > 10; it++) {
      const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
      for (const i of use) { const f = [1, t(i), t(i) * t(i)]; for (let a = 0; a < 3; a++) { v[a] += f[a] * r[i]; for (let b = 0; b < 3; b++) S[a][b] += f[a] * f[b]; } }
      // resolver 3x3 (Cramer)
      const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      const D = det(S); c = [0, 1, 2].map((k) => det(S.map((row, a) => row.map((val, b2) => (b2 === k ? v[a] : val)))) / D);
      const fit = (i) => c[0] + c[1] * t(i) + c[2] * t(i) * t(i);
      use = use.filter((i) => Math.abs(r[i] - fit(i)) <= 4);
    }
    const fit = (i) => c[0] + c[1] * t(i) + c[2] * t(i) * t(i);
    const e = new Int32Array(len);
    for (let i = 0; i < len; i++) {
      const f = Math.round(fit(i)), corner = i < CORNER || i > len - 1 - CORNER;
      // medida directa si es fiable y cuadra con la curva (conserva el borde natural); en las esquinas, la curva del
      // negativo solo puede hacer la banda más ancha
      e[i] = corner ? (ok[i] ? Math.max(r[i], f - 3) : f) : (ok[i] && Math.abs(r[i] - f) <= 3 ? r[i] : f);
    }
    const all = Array.from(e).sort((u, v) => u - v); TH[name] = all[all.length >> 1];
    return e;
  };
  const eT = side(W, (i, k) => [i, k], 't'), eB = side(W, (i, k) => [i, H - 1 - k], 'b');
  const eL = side(H, (i, k) => [k, i], 'l'), eR = side(H, (i, k) => [W - 1 - k, i], 'r');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y < eT[x] || H - 1 - y < eB[x] || x < eL[y] || W - 1 - x < eR[y]) frame[y * W + x] = 1;
}
// 3 px más hacia dentro: la transición suave del borde del negativo también es marco
for (let pass = 0; pass < 3; pass++) {
  const add = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (frame[k] || !nearEdge(x, y)) continue; if (frame[k - 1] || frame[k + 1] || frame[k - W] || frame[k + W]) add.push(k); }
  for (const k of add) frame[k] = 1;
}
const isFrame = (x, y) => frame[y * W + x] === 1;
// rectángulo interior (para el ancla y la comprobación de que no se inventa nada)
const inner = { x0: 0, x1: W, y0: 0, y1: H };
{ const mid = (a, b) => (a + b) >> 1, cx = mid(0, W), cy = mid(0, H);
  let x = 0; while (x < W && isFrame(x, cy)) x++; inner.x0 = x;
  x = W - 1; while (x > 0 && isFrame(x, cy)) x--; inner.x1 = x + 1;
  let y = 0; while (y < H && isFrame(Math.round(W * 0.22), y)) y++; inner.y0 = y;
  y = H - 1; while (y > 0 && isFrame(Math.round(W * 0.22), y)) y--; inner.y1 = y + 1; }
// Ampliación alrededor del ancla: cada píxel nuevo toma el píxel de la foto en ancla + (p − ancla) / z
const ax = +axArg, ay = ayArg === 'base' ? inner.y1 : +ayArg;
const sx0 = ax + (inner.x0 - ax) / z, sx1 = ax + (inner.x1 - ax) / z, sy0 = ay + (inner.y0 - ay) / z, sy1 = ay + (inner.y1 - ay) / z;
// el recorte fuente debe estar dentro del contenido (si no, se estaría inventando imagen)
if (sx0 < inner.x0 - 1 || sx1 > inner.x1 + 1 || sy0 < inner.y0 - 1 || sy1 > inner.y1 + 1) { console.error('el ancla y el zoom sacarían imagen de fuera de la foto'); process.exit(1); }
const pad = 40;   // se amplía también un poco bajo el marco para que el borde irregular no deje ver la foto antigua
const ex0 = Math.max(0, inner.x0 - pad), ex1 = Math.min(W, inner.x1 + pad), ey0 = Math.max(0, inner.y0 - pad), ey1 = Math.min(H, inner.y1 + pad);
const cx0 = ax + (ex0 - ax) / z, cy0 = ay + (ey0 - ay) / z, cw = (ex1 - ex0) / z, ch = (ey1 - ey0) / z;
const zoomed = await img.clone().removeAlpha()
  .extract({ left: Math.round(cx0), top: Math.round(cy0), width: Math.round(cw), height: Math.round(ch) })
  .resize(ex1 - ex0, ey1 - ey0, { kernel: 'lanczos3' }).raw().toBuffer();

// Composición: foto ampliada dentro, marco original encima (con 2 px de transición suave)
const outBuf = Buffer.from(data);
const zw = ex1 - ex0;
const dist = (x, y) => { for (let d = 1; d <= 2; d++) if (isFrame(Math.max(0, x - d), y) || isFrame(Math.min(W - 1, x + d), y) || isFrame(x, Math.max(0, y - d)) || isFrame(x, Math.min(H - 1, y + d))) return d - 1; return 2; };
for (let y = ey0; y < ey1; y++) for (let x = ex0; x < ex1; x++) {
  if (isFrame(x, y)) continue;
  const d = dist(x, y), a = d >= 2 ? 1 : (d + 1) / 3;
  const i = (y * W + x) * C, j = ((y - ey0) * zw + (x - ex0)) * C;
  for (let c = 0; c < C; c++) outBuf[i + c] = Math.round(zoomed[j + c] * a + data[i + c] * (1 - a));
}
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(outBuf, { raw: { width: W, height: H, channels: C } }).withMetadata().jpeg({ quality: +(process.env.CALIDAD || 95), chromaSubsampling: '4:4:4' }).toFile(out);
console.log(JSON.stringify({ W, H, grosorBanda: TH, marco: inner, zoom: z, ancla: [ax, ay], recorteFuente: [Math.round(sx0), Math.round(sy0), Math.round(sx1), Math.round(sy1)] }));
