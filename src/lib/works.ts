import { photos, type Photo } from './photos';

/** WORKS se organiza desde el Finder: fotos/works/<NN NOMBRE>/fotos… y, opcionalmente, subcarpetas
 *  fotos/works/<NN NOMBRE>/<NN SECCIÓN>/ que se muestran como secciones (colecciones) en ese orden.
 *  El número de carpeta fija el orden; el nombre (sin número) es el título; las fotos van por nombre de archivo. */
export interface Section { slug: string; name: string; order: number; photos: Photo[] }
export interface Work { slug: string; name: string; order: number; photos: Photo[]; sections: Section[]; loose: Photo[] }

const byOrd = (a: Photo, b: Photo) => (a.ord ?? 0) - (b.ord ?? 0);
const map = new Map<string, Work>();
for (const p of photos) {
  if (p.cat !== 'work' || !p.work) continue;
  let w = map.get(p.work);
  if (!w) { w = { slug: p.work, name: p.workName || p.work, order: p.workOrder ?? 999, photos: [], sections: [], loose: [] }; map.set(p.work, w); }
  if (p.section) {
    let sec = w.sections.find((x) => x.slug === p.section);
    if (!sec) { sec = { slug: p.section, name: p.sectionName || p.section, order: p.sectionOrder ?? 999, photos: [] }; w.sections.push(sec); }
    sec.photos.push(p);
  } else w.loose.push(p);
}
export const works: Work[] = [...map.values()]
  .map((w) => {
    w.sections.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const sec of w.sections) sec.photos.sort(byOrd);
    w.loose.sort(byOrd);
    w.photos = [...w.sections.flatMap((sec) => sec.photos), ...w.loose];
    return w;
  })
  .filter((w) => w.photos.length > 0)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
