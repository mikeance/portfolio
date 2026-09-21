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
    return p.lum + nature + dark;
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
