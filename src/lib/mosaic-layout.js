// Colocación del mosaico (web y editor del catálogo). Mosaico de columnas:
// - Las columnas tienen anchos ligeramente distintos (±5 %): dos fotos iguales en columnas vecinas no miden lo mismo,
//   así que las columnas nunca van emparejadas ni forman filas; el mosaico se descoloca solo al bajar.
// - La primera fila empieza alineada arriba (y no se mueve); la foto 1 va arriba a la izquierda.
// - Cada foto va a la columna más baja, en orden. Las más cuadradas (120 mm…) buscan la columna más ancha de las
//   que están casi igual de bajas, para acercarse a la altura de las de 35 mm.
// - Las horizontales ocupan dos columnas vecinas cuando están casi a la misma altura (la diferencia se reparte en
//   los huecos de la más corta, sin dejar blanco) y nunca dos a la misma altura.
// - Si la siguiente foto es horizontal y no hay dos columnas a la par, las verticales que van antes se colocan en la
//   columna que mejor iguala una pareja, para que la horizontal aparezca pronto (sin agrandar ninguna foto).
// El catálogo usa una copia de este archivo sin «export» (la genera scripts/catalog.mjs).

/**
 * @param {number[]} ratios  proporción ancho/alto de cada foto, en orden
 * @param {number} W         ancho disponible en px
 * @param {number} cols      columnas
 * @param {{gap?: number, pad?: number}} [opt]
 * @returns {{pos: {x: number, y: number, w: number}[], height: number}}
 */
export function packMosaic(ratios, W, cols, opt = {}) {
  const GAP = opt.gap ?? 10, PAD = opt.pad ?? 12, WIDE = 1.15, BIG_EVERY = 8;
  const PATTERN = { 2: [1.04, 0.96], 3: [1.05, 0.95, 1.0], 4: [1.05, 0.95, 1.03, 0.97], 5: [1.05, 0.94, 1.03, 0.96, 1.02] };
  const f = PATTERN[cols] || new Array(cols).fill(1), fs = f.reduce((a, b) => a + b, 0);
  const avail = W - (cols - 1) * GAP;
  const cw = f.map((v) => (avail * v) / fs), cx = [];
  cw.reduce((x, w, j) => { cx[j] = x; return x + w + GAP; }, 0);
  const hRef = (avail / cols - PAD) / 0.667 + PAD;
  const isWide = (r) => r > WIDE, isSquarer = (r) => r >= 0.72 && r <= WIDE;
  const hgt = (w, r) => (w - PAD) / r + PAD;
  const pos = new Array(ratios.length);
  const h = new Array(cols).fill(0);
  const stacks = Array.from({ length: cols }, () => []);               // fotos movibles de cada columna (no 1ª fila)
  const bands = [];                                                     // franjas de las horizontales
  let queue = ratios.map((_, i) => i), count = 0, lastBig = -99, lastWide = null, pending = null;   // pending = {i, c}: foto grande reservada

  const put = (i, x, y, w) => { pos[i] = { x, y, w }; count++; };
  const placeV = (i, c) => {
    const w = cw[c], y = h[c];
    put(i, cx[c], y, w);
    if (y > 0) stacks[c].push({ i, top: y });
    h[c] = y + hgt(w, ratios[i]) + GAP;
  };
  // ocupa las columnas c y c+1: la más corta reparte la diferencia entre sus huecos
  const placeSpan = (i, c) => {
    const short = h[c] <= h[c + 1] ? c : c + 1, d = Math.abs(h[c] - h[c + 1]), y = Math.max(h[c], h[c + 1]);
    const st = stacks[short];
    if (d > 0 && st.length) { const extra = d / st.length; st.forEach((s, k) => { s.top += extra * (k + 1); pos[s.i].y = s.top; }); }
    const w = cw[c] + cw[c + 1] + GAP, r = ratios[i], hh = hgt(w, r);
    put(i, cx[c], y, w);
    if (isWide(r)) {
      bands.push({ top: y, bottom: y + hh }); lastWide = { c, bottom: y + hh + GAP };
    } else lastWide = null;
    h[c] = h[c + 1] = y + hh + GAP;
    stacks[c] = []; stacks[c + 1] = [];
  };
  const pairAt = (c) => {                                               // pareja de columnas vecinas más pareja en altura
    let best = -1, bd = Infinity;
    for (const j of [c - 1, c]) if (j >= 0 && j + 1 < cols) { const d = Math.abs(h[j] - h[j + 1]); if (d < bd) { bd = d; best = j; } }
    return { j: best, d: bd };
  };
  const lowest = () => h.indexOf(Math.min(...h));

  const lowestFree = () => {                                            // columna más baja fuera de la reserva
    let c = -1;
    for (let j = 0; j < cols; j++) if (!(pending && (j === pending.c || j === pending.c + 1)) && (c < 0 || h[j] < h[c])) c = j;
    return c < 0 ? lowest() : c;
  };
  while (queue.length) {
    const c = lowestFree();
    const wi = queue.findIndex((i) => isWide(ratios[i])), vi = queue.findIndex((i) => !isWide(ratios[i]));
    // horizontal: si es la siguiente (o solo quedan horizontales) y hay dos columnas vecinas casi a la par
    if (cols >= 2 && wi >= 0 && (vi < 0 || wi === 0)) {
      const { j, d } = pairAt(c);
      const short = j >= 0 ? (h[j] <= h[j + 1] ? j : j + 1) : -1;
      const tolerable = j >= 0 && d <= 14 * stacks[short].length + 1;
      const y = j >= 0 ? Math.max(h[j], h[j + 1]) : 0, hh = j >= 0 ? hgt(cw[j] + cw[j + 1] + GAP, ratios[queue[wi]]) : 0;
      const alone = cols < 3 || !bands.some((o) => y < o.bottom && y + hh > o.top);
      if (tolerable && alone) { placeSpan(queue[wi], j); queue.splice(wi, 1); continue; }
      if (vi < 0) {
        // solo quedan horizontales: la pareja de columnas más igualada de todas; si ninguna vale, en una sola columna
        let bj = -1, bd = Infinity;
        for (let q = 0; q + 1 < cols; q++) { const dd = Math.abs(h[q] - h[q + 1]), sq = h[q] <= h[q + 1] ? q : q + 1; if (dd <= 14 * stacks[sq].length + 1 && dd + Math.max(h[q], h[q + 1]) * 0.001 < bd) { bd = dd; bj = q; } }
        if (bj >= 0) placeSpan(queue[wi], bj); else placeV(queue[wi], lowest());
        queue.splice(wi, 1); continue;
      }
    }
    if (vi < 0) break;
    const free = h.map((v, j) => (v === 0 ? j : -1)).filter((j) => j >= 0);
    if (wi === vi + 1 && free.length === 2 && free[1] === free[0] + 1) {
      placeSpan(queue[wi], free[0]); queue.splice(wi, 1); continue;
    }
    const i = queue[vi];
    let col = c;
    // hay una horizontal esperando (es la siguiente o casi): esta vertical va, entre las columnas bajas, a la que más
    // iguala alguna pareja de columnas vecinas, para que la horizontal encuentre sitio pronto
    if (cols >= 3 && wi >= 0 && wi <= vi + 2) {
      let best = Infinity;
      for (let j = 0; j < cols; j++) {
        if (h[j] > h[c] + 0.35 * hRef) continue;                        // solo columnas casi tan bajas como la más baja
        const nh = h.slice(); nh[j] += hgt(cw[j], ratios[i]) + GAP;
        let pd = Infinity; for (let q = 0; q + 1 < cols; q++) pd = Math.min(pd, Math.abs(nh[q] - nh[q + 1]) + 0.02 * Math.max(nh[q], nh[q + 1]));
        const score = pd + 0.15 * (h[j] - h[c]);
        if (score < best) { best = score; col = j; }
      }
    }
    if (isSquarer(ratios[i]) && col === c) {                                         // la más ancha de las columnas casi igual de bajas
      for (let j = 0; j < cols; j++) if (h[j] <= h[c] + 0.08 * hRef && cw[j] > cw[col]) col = j;
    }
    placeV(i, col); queue.splice(vi, 1);
  }

  let height = 0;
  ratios.forEach((r, i) => { if (pos[i]) height = Math.max(height, pos[i].y + hgt(pos[i].w, r)); });
  return { pos, height };
}

/**
 * Orden de lectura del mosaico tal y como se ve: de izquierda a derecha y, al acabar la «fila», hacia abajo.
 * Una fila son las fotos cuyo borde superior está cerca del de la más alta que queda (media foto normal).
 * Lo usan el visor de la web (siguiente / anterior) y los números del Estudio.
 * @param {{x: number, y: number, w: number}[]} pos  posiciones de packMosaic
 * @param {number[]} ratios
 * @returns {number[]} índices de las fotos en orden de lectura
 */
export function readingOrder(pos, ratios, opt = {}) {
  const PAD = opt.pad ?? 12;
  const items = pos.map((p, i) => (p ? { i, x: p.x, y: p.y, h: (p.w - PAD) / ratios[i] + PAD } : null)).filter(Boolean);
  if (!items.length) return [];
  const hs = items.map((it) => it.h).sort((a, b) => a - b), tol = hs[Math.floor(hs.length / 2)] * 0.5;
  const rest = items.sort((a, b) => a.y - b.y || a.x - b.x), out = [];
  while (rest.length) {
    const top = rest[0].y, fila = rest.filter((it) => it.y <= top + tol).sort((a, b) => a.x - b.x);
    for (const it of fila) { out.push(it.i); rest.splice(rest.indexOf(it), 1); }
  }
  return out;
}
