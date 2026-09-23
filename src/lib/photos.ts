import all from '../data/photos.json' with { type: 'json' };

export interface Photo {
  id: string;
  ratio: number; // ancho / alto
  hue: number;
  sat: number;
  lum: number;
  lumB?: number;  // luz del cuarto inferior (color del texto superpuesto)
  cat: 'faces' | 'editorial' | 'lifestyle' | 'home' | 'work';
  proj?: string;  // carpeta de sesión/proyecto dentro de fotos/<categoría>/
  src?: string;   // ruta relativa dentro de fotos/
  sha?: string;   // huella del contenido (para no repetir la misma foto)
  title?: string;
  work?: string;      // WORKS: slug de la carpeta fotos/works/<NN NOMBRE>
  workName?: string;
  workOrder?: number;
  section?: string;   // colección dentro del work (subcarpeta)
  sectionName?: string;
  sectionOrder?: number;
  face?: number;  // área de la cara mayor (0–1), solo en FACES
  faces?: number;
  ord?: number;   // posición manual fijada en el catálogo (Faces / Life)
  ordW?: number;  // WORKS: posición manual en el work (hover general; y mosaico si no tiene colecciones)
  ordS?: number;  // WORKS: posición manual dentro de su colección
}

export const photos = all as Photo[];
export const categories = ['editorial', 'faces', 'lifestyle'] as const;
export type Category = (typeof categories)[number];

/** Neutros (b/n, grises) primero por luminosidad; después el resto por tono. */
export function sortByColor(list: Photo[]): Photo[] {
  const neutral = list.filter((p) => p.sat < 0.12).sort((a, b) => a.lum - b.lum);
  const colour = list.filter((p) => p.sat >= 0.12).sort((a, b) => a.hue - b.hue);
  return [...neutral, ...colour];
}

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Orden para LIFE: primero lo luminoso y la naturaleza (verdes, azules, mar), lo oscuro va bajando,
 *  y el blanco y negro se intercala de forma uniforme en vez de ir en bloque. */
export function sortLife(list: Photo[]): Photo[] {
  const score = (p: Photo) => {
    const nature = p.sat >= 0.12 && p.hue >= 70 && p.hue <= 250 ? 0.35 : 0;
    const dark = p.lum < 0.28 ? -0.4 : 0;
    return Math.min(p.lum, 0.8) + nature + dark; // las muy claras (quemadas) no van las primeras
  };
  const byScore = (a: Photo, b: Photo) => {
    const ba = Math.round(score(b) * 4), aa = Math.round(score(a) * 4);
    return ba !== aa ? ba - aa : a.hue - b.hue; // dentro de cada banda de luz, por tono
  };
  const colour = list.filter((p) => p.sat >= 0.12).sort(byScore);
  const bw = list.filter((p) => p.sat < 0.12).sort((a, b) => b.lum - a.lum);
  if (!colour.length || !bw.length) return [...colour, ...bw];
  const out: Photo[] = [];
  const step = colour.length / bw.length;
  let next = step / 2, bi = 0;
  colour.forEach((p, i) => {
    out.push(p);
    while (bi < bw.length && i + 1 >= next) { out.push(bw[bi++]); next += step; }
  });
  return [...out, ...bw.slice(bi)];
}

/** Orden para FACES: primero los planos más cerrados (cara grande) y luminosos; cada sesión (mismo sujeto)
 *  se reparte a lo largo de todo el scroll para no repetir a la misma persona cerca; B/N intercalado. */
export function sortFaces(list: Photo[]): Photo[] {
  const light = (p: Photo) => Math.min(p.lum, 0.8) - (p.lum < 0.28 ? 0.3 : 0);
  const closeup = (p: Photo) => Math.min(p.face ?? 0, 0.25) / 0.25;
  const score = (p: Photo) => 0.6 * closeup(p) + 0.4 * light(p);
  const N = list.length;
  const groups = new Map<string, Photo[]>();
  for (const p of list) groups.set(p.proj || '', [...(groups.get(p.proj || '') || []), p]);
  const key = new Map<Photo, number>();
  for (const g of groups.values()) {
    g.sort((a, b) => score(b) - score(a));
    g.forEach((p, i) => key.set(p, ((i + 0.5) / g.length) * N - 0.5 * N * score(p)));
  }
  const byKey = (a: Photo, b: Photo) => key.get(a)! - key.get(b)!;
  const colour = list.filter((p) => p.sat >= 0.12).sort(byKey);
  const bw = list.filter((p) => p.sat < 0.12).sort(byKey);
  if (!colour.length || !bw.length) return [...colour, ...bw];
  const out: Photo[] = [];
  const step = colour.length / bw.length;
  let next = step / 2, bi = 0;
  colour.forEach((p, i) => { out.push(p); while (bi < bw.length && i + 1 >= next) { out.push(bw[bi++]); next += step; } });
  return [...out, ...bw.slice(bi)];
}

/** Evita que dos fotos de la misma sesión (mismo sujeto/lugar) queden a menos de `window` posiciones. */
export function spreadSessions(list: Photo[], window = 6, lookahead = 16): Photo[] {
  const out: Photo[] = [];
  const rest = list.slice();
  const left = new Map<string, number>();
  for (const p of rest) left.set(p.proj || '', (left.get(p.proj || '') || 0) + 1);
  while (rest.length) {
    const recent = new Set(out.slice(-window).map((p) => p.proj));
    const ok = (p: Photo) => !recent.has(p.proj);
    // entre las próximas del orden estético, la que no repite sesión; si empatan, la sesión con más fotos pendientes
    let best = -1, bestLeft = -1;
    for (let i = 0; i < Math.min(lookahead, rest.length); i++) {
      if (!ok(rest[i])) continue;
      const l = left.get(rest[i].proj || '') || 0;
      if (l > bestLeft) { best = i; bestLeft = l; }
    }
    if (best < 0) best = rest.findIndex(ok);
    if (best < 0) best = 0; // no hay alternativa: se acepta la repetición
    const p = rest.splice(best, 1)[0];
    left.set(p.proj || '', (left.get(p.proj || '') || 0) - 1);
    out.push(p);
  }
  return out;
}

/** Portada automática: lo mejor de cada categoría (~240 fotos), elegido con azar (semilla fija) y con tope
 *  por sesión para que no salgan fotos consecutivas del mismo rollo; orden con la estética de Life y
 *  sesiones repartidas a lo largo del scroll. */
export function homeMix(all: Photo[], total = 240, seed = 7): Photo[] {
  let t = seed + 0x6d2b79f5;
  const rnd = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const light = (p: Photo) => Math.min(p.lum, 0.8) - (p.lum < 0.28 ? 0.4 : 0);
  const quality: Record<string, (p: Photo) => number> = {
    faces: (p) => 0.6 * (Math.min(p.face ?? 0, 0.25) / 0.25) + 0.4 * light(p),
    editorial: (p) => light(p) + (p.sat >= 0.12 ? 0.15 : 0),
    lifestyle: (p) => light(p) + (p.sat >= 0.12 && p.hue >= 70 && p.hue <= 250 ? 0.35 : 0),
  };
  const cats = ['faces', 'editorial', 'lifestyle'];
  const per = Math.ceil(total / cats.length);
  const seen = new Set<string>();
  const picked: Photo[] = [];
  for (const c of cats) {
    const ranked = all.filter((p) => p.cat === c).sort((a, b) => quality[c](b) - quality[c](a));
    // candidatas: el 70% mejor, barajadas
    const pool = ranked.slice(0, Math.max(per, Math.ceil(ranked.length * 0.7)));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const perSession = new Map<string, number>();
    let n = 0;
    for (const cap of [4, 8, 99]) {
      for (const p of pool) {
        if (n >= per) break;
        if (picked.includes(p) || (p.sha && seen.has(p.sha))) continue;
        const k = p.proj || '';
        if ((perSession.get(k) || 0) >= cap) continue;
        perSession.set(k, (perSession.get(k) || 0) + 1);
        if (p.sha) seen.add(p.sha);
        picked.push(p); n++;
      }
      if (n >= per) break;
    }
  }
  return spreadSessions(sortLife(picked));
}

/** Desordena un poco: cada foto se mueve hasta `amount` posiciones (azar con semilla fija). */
export function jitter(list: Photo[], amount = 10, seed = 3): Photo[] {
  let t = seed + 0x6d2b79f5;
  const rnd = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  return list.map((p, i) => ({ p, k: i + (rnd() - 0.5) * 2 * amount })).sort((a, b) => a.k - b.k).map((x) => x.p);
}
