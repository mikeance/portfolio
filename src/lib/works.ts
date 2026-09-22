import { photos, type Photo } from './photos';

/** WORKS se organiza desde el Finder: fotos/works/<NN NOMBRE>/fotos…
 *  El número de la carpeta fija el orden de la lista; el nombre (sin número) es el título;
 *  el orden de las fotos dentro es el alfabético de sus archivos. */
export interface Work { slug: string; name: string; order: number; photos: Photo[] }

const map = new Map<string, Work>();
for (const p of photos) {
  if (p.cat !== 'work' || !p.work) continue;
  let w = map.get(p.work);
  if (!w) { w = { slug: p.work, name: p.workName || p.work, order: p.workOrder ?? 999, photos: [] }; map.set(p.work, w); }
  w.photos.push(p);
}
export const works: Work[] = [...map.values()]
  .map((w) => ({ ...w, photos: w.photos.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)) }))
  .filter((w) => w.photos.length > 0)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
