import all from '../data/photos.json';

export interface Photo {
  id: string;
  ratio: number; // ancho / alto
  hue: number;
  sat: number;
  lum: number;
  cat: 'faces' | 'editorial' | 'lifestyle' | 'home';
  proj?: string;  // carpeta de sesión/proyecto dentro de fotos/<categoría>/
  src?: string;   // ruta relativa dentro de fotos/
  sha?: string;   // huella del contenido (para no repetir la misma foto)
  title?: string;
  works?: string[];
  face?: number;  // área de la cara mayor (0–1), solo en FACES
  faces?: number;
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

/** Portada automática: lo mejor de cada categoría (unas 240 fotos) mezclado con la estética de Life. */
export function homeMix(all: Photo[], total = 240): Photo[] {
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
    const list = all.filter((p) => p.cat === c).sort((a, b) => quality[c](b) - quality[c](a));
    let n = 0;
    for (const p of list) { if (n >= per) break; if (p.sha && seen.has(p.sha)) continue; if (p.sha) seen.add(p.sha); picked.push(p); n++; }
  }
  return sortLife(picked);
}
