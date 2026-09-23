import { photos, type Photo } from './photos';

/** WORKS se organiza desde el Finder: fotos/works/<NN NOMBRE>/fotos… y, opcionalmente, subcarpetas
 *  fotos/works/<NN NOMBRE>/<NN SECCIÓN>/ que se muestran como secciones (colecciones) en ese orden.
 *  El número de carpeta fija el orden; el nombre (sin número) es el título; las fotos van por nombre de archivo.
 *  Un work con secciones se abre como lista de colecciones (igual que /works); cada colección tiene su mosaico.
 *  Orden manual (editor del catálogo, portada.html?sel=W:<slug>): ordW = orden del work (hover general y, si no
 *  tiene colecciones, su mosaico); ordS = orden dentro de una colección (su hover y su mosaico). */
export interface Section { slug: string; name: string; order: number; photos: Photo[]; href: string }
export interface Work { slug: string; name: string; order: number; photos: Photo[]; sections: Section[]; loose: Photo[]; href: string }

const byOrd = (a: Photo, b: Photo) => (a.ord ?? 0) - (b.ord ?? 0);
/** Las que tienen posición manual, en ese orden; después el resto tal cual. */
const manualFirst = (list: Photo[], key: (p: Photo) => number | undefined) => {
  const m = list.filter((p) => key(p) !== undefined).sort((a, b) => key(a)! - key(b)!);
  return [...m, ...list.filter((p) => key(p) === undefined)];
};
const map = new Map<string, Work>();
for (const p of photos) {
  if (p.cat !== 'work' || !p.work) continue;
  let w = map.get(p.work);
  if (!w) { w = { slug: p.work, name: p.workName || p.work, order: p.workOrder ?? 999, photos: [], sections: [], loose: [], href: `/works/${p.work}` }; map.set(p.work, w); }
  if (p.section) {
    let sec = w.sections.find((x) => x.slug === p.section);
    if (!sec) { sec = { slug: p.section, name: p.sectionName || p.section, order: p.sectionOrder ?? 999, photos: [], href: `/works/${p.work}/${p.section}` }; w.sections.push(sec); }
    sec.photos.push(p);
  } else w.loose.push(p);
}
export const works: Work[] = [...map.values()]
  .map((w) => {
    w.sections.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const sec of w.sections) sec.photos = manualFirst(sec.photos.sort(byOrd), (p) => p.ordS);
    w.loose = manualFirst(w.loose.sort(byOrd), (p) => p.ordW);
    // Hover general del work: primero las que tienen orden manual (ordW), después el resto (colecciones en orden, luego sueltas)
    w.photos = manualFirst([...w.sections.flatMap((sec) => sec.photos), ...w.loose], (p) => p.ordW);
    return w;
  })
  .filter((w) => w.photos.length > 0)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
