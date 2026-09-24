// Colocación del mosaico (web y editor del catálogo).
// - Todas las verticales tienen la altura de una vertical de 35 mm: las de 120 mm (más anchas) ganan ancho, no pierden alto.
// - Las horizontales ocupan dos columnas (una sola en móvil a todo el ancho) y nunca dos a la misma altura.
// - La primera fila va alineada arriba y ocupa todo el ancho; después cada hueco más bajo se rellena con las fotos
//   siguientes, escalándolas un poco (±15 %) para que encajen justas: no quedan huecos y el mosaico se va descolocando.
// El catálogo usa una copia de este archivo sin «export» (la genera scripts/catalog.mjs).

/**
 * @param {number[]} ratios  proporción ancho/alto de cada foto, en orden
 * @param {number} W         ancho disponible en px
 * @param {number} cols      columnas de referencia (una vertical de 35 mm = una columna)
 * @param {{gap?: number, pad?: number}} [opt]
 * @returns {{pos: {x: number, y: number, w: number}[], height: number}}
 */
export function packMosaic(ratios, W, cols, opt = {}) {
  const GAP = opt.gap ?? 10, PAD = opt.pad ?? 12, WIDE = 1.15, REF = 0.667;
  const SMIN = 0.86, SMAX = 1.16, EPS = 0.5;
  const n = ratios.length;
  const col = (W - (cols - 1) * GAP) / cols;
  const hRef = (col - PAD) / REF + PAD;                                   // alto de una vertical de 35 mm
  const isWide = (r) => r > WIDE;
  const isSquarer = (r) => r >= 0.72 && r <= WIDE;                         // verticales más cuadradas que el 35 mm
  const nat = (r) => (isWide(r) ? Math.min(W, 2 * col + GAP) : (hRef - PAD) * r + PAD);
  const hgt = (w, r) => (w - PAD) / r + PAD;
  const placed = [];                                                      // {i, x0, x1, top, bottom}
  const bands = [];                                                       // franjas ocupadas por horizontales
  let queue = Array.from({ length: n }, (_, i) => i);

  // cada foto ocupa también el hueco a su derecha: así las franjas entre fotos no cuentan como sitio libre
  const right = (p) => Math.min(W, p.x1 + GAP);
  const skyline = () => {
    const xs = new Set([0, W]);
    for (const p of placed) { xs.add(p.x0); xs.add(right(p)); }
    const b = [...xs].sort((a, c) => a - c), segs = [];
    for (let k = 0; k < b.length - 1; k++) {
      const a = b[k], c = b[k + 1];
      if (c - a < EPS) continue;
      let h = 0;
      for (const p of placed) if (p.x0 < c - EPS && right(p) > a + EPS) h = Math.max(h, p.bottom + GAP);
      const last = segs[segs.length - 1];
      if (last && Math.abs(last.h - h) < EPS) last.b = c; else segs.push({ a, b: c, h });
    }
    return segs;
  };

  const bandFree = (y, h) => cols < 3 || !bands.some((o) => y < o.bottom && y + h > o.top);

  // intenta llenar el tramo [a,b] a la altura y con las siguientes fotos (se puede saltar hasta 2 para que encajen)
  const fill = (a, b, y, maxSkip = 2, smin = SMIN, smax = SMAX) => {
    const S = b - a - (b < W - EPS ? GAP : 0);   // si el tramo no llega al borde, la última foto deja su hueco
    let best = null;
    for (let skip = 0; skip <= maxSkip && skip < queue.length; skip++) {
      let sum = 0, wides = 0, sq = 0;
      for (let k = 1; k <= 6 && skip + k <= queue.length; k++) {
        const r = ratios[queue[skip + k - 1]];
        sum += nat(r); if (isWide(r)) wides++; if (isSquarer(r)) sq++;
        if (wides > 1) break;
        const s = (S - (k - 1) * GAP) / sum;
        if (s < smin) break;
        if (s > smax) continue;
        const ids = queue.slice(skip, skip + k);
        if (wides && !bandFree(y, hgt(nat(ratios[ids.find((i) => isWide(ratios[i]))]) * s, ratios[ids.find((i) => isWide(ratios[i]))]))) continue;
        // encoger una foto más cuadrada cuesta más: debe verse tan alta como las de 35 mm
        const cost = Math.abs(Math.log(s)) * (1 + (sq ? 2.5 : 0) * (s < 1 ? 1 : 0.3)) + 0.35 * skip + 0.01 * k;
        if (!best || cost < best.cost) best = { cost, ids, s };
      }
    }
    return best;
  };

  const place = (a, y, sel) => {
    let x = a;
    for (const i of sel.ids) {
      const r = ratios[i], w = nat(r) * sel.s, h = hgt(w, r);
      placed.push({ i, x0: x, x1: x + w, top: y, bottom: y + h });
      if (isWide(r)) bands.push({ top: y, bottom: y + h });
      x += w + GAP;
    }
    const used = new Set(sel.ids);
    queue = queue.filter((i) => !used.has(i));
  };

  // al juntar tramos de distinta altura, las fotos de la parte baja bajan un poco (sin dejar hueco blanco)
  const settle = (a, b, y) => {
    for (const p of placed) {
      if (right(p) <= a + EPS || p.x0 >= b - EPS || p.bottom + GAP >= y - EPS) continue;
      const below = placed.some((o) => o !== p && o.x0 < right(p) - EPS && right(o) > p.x0 + EPS && o.top > p.top + EPS);
      if (below) continue;
      const d = y - (p.bottom + GAP);
      p.top += d; p.bottom += d;
    }
  };

  while (queue.length) {
    const segs = skyline();
    let k = 0;
    for (let j = 1; j < segs.length; j++) if (segs[j].h < segs[k].h - EPS) k = j;
    // se prueba el tramo más bajo solo y junto a sus vecinos (hasta 3 tramos): gana el que encaja con menos ajuste.
    // Por pasos: primero desniveles pequeños; si nada encaja, se busca más adelante en la cola y se permite algo más
    // de ajuste; solo al final se aceptan desniveles mayores (que bajan un poco las fotos de la parte baja).
    const tryAll = (maxDiff, maxSkip, smin, smax) => {
      let best = null;
      for (let a = Math.max(0, k - 2); a <= k; a++) for (let b = k; b <= Math.min(segs.length - 1, a + 2); b++) {
        const yy = Math.max(...segs.slice(a, b + 1).map((s) => s.h)), diff = yy - segs[k].h;
        if (diff > maxDiff) continue;
        const f = fill(segs[a].a, segs[b].b, yy, maxSkip, smin, smax);
        if (!f) continue;
        const cost = f.cost + 4 * diff / hRef;
        if (!best || cost < best.cost) best = { cost, a, b, y: yy, sel: f };
      }
      return best;
    };
    const best = tryAll(0.05 * hRef, 2, SMIN, SMAX) || tryAll(0.05 * hRef, 8, 0.8, 1.25)
      || tryAll(0.12 * hRef, 8, 0.8, 1.25) || tryAll(0.3 * hRef, 8, 0.8, 1.25);
    // al final de la página (pocas fotos): se colocan en el tramo libre más bajo donde quepan, sin mover otras
    if (!best && queue.length <= 8) {
      const order = segs.map((g, j) => j).sort((u, v) => segs[u].h - segs[v].h);
      let done = false;
      for (const j of order) {
        const g = segs[j], S = g.b - g.a - (g.b < W - EPS ? GAP : 0), r = ratios[queue[0]], s = S / nat(r);
        if (s < 0.8) continue;
        const sel = { ids: [queue[0]], s: Math.min(s, 1.15) };
        if (isWide(r) && !bandFree(g.h, hgt(nat(r) * sel.s, r)) && order.length > 1) continue;
        place(g.a, g.h, sel); done = true; break;
      }
      if (done) continue;
    }
    let lo = best ? best.a : k, hi = best ? best.b : k, y = best ? best.y : segs[k].h, sel = best ? best.sel : null;
    // si no encaja nada, se junta con el tramo vecino más parecido en altura y se vuelve a probar
    while (!sel && (lo > 0 || hi < segs.length - 1)) {
      const left = lo > 0 ? segs[lo - 1] : null, right = hi < segs.length - 1 ? segs[hi + 1] : null;
      if (left && (!right || Math.abs(left.h - y) <= Math.abs(right.h - y))) lo--; else hi++;
      y = Math.max(...segs.slice(lo, hi + 1).map((s) => s.h));
      sel = fill(segs[lo].a, segs[hi].b, y);
    }
    if (!sel) sel = { ids: [queue[0]], s: Math.min(1, (segs[hi].b - segs[lo].a - (segs[hi].b < W - EPS ? GAP : 0)) / nat(ratios[queue[0]])) };
    settle(segs[lo].a, segs[hi].b, y);
    place(segs[lo].a, y, sel);
  }

  const pos = new Array(n);
  let height = 0;
  for (const p of placed) { pos[p.i] = { x: p.x0, y: p.top, w: p.x1 - p.x0 }; height = Math.max(height, p.bottom); }
  return { pos, height };
}
