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
