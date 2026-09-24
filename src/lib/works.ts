import { photos, type Photo } from './photos';

/** WORKS se organiza desde el Finder: fotos/works/<NN NOMBRE>/fotos… y, opcionalmente, subcarpetas
 *  fotos/works/<NN NOMBRE>/<NN SECCIÓN>/ que se muestran como secciones (colecciones) en ese orden.
 *  El número de carpeta fija el orden; el nombre (sin número) es el título; las fotos van por nombre de archivo.
 *  Un work con secciones se abre como lista de colecciones (igual que /works); cada colección tiene su mosaico.
 *  Orden manual (editor del catálogo, portada.html?sel=W:<slug>): ordW = orden del work, ordS = orden de la colección.
 *  `strip` (la fila del hover) = solo las fotos con orden manual, si lo hay; si no, todas.
 *  `photos` (el mosaico) = todas: primero las del orden manual, después el resto por carpeta. */
export interface Section { slug: string; name: string; order: number; photos: Photo[]; strip: Photo[]; href: string }
export interface Work { slug: string; name: string; order: number; photos: Photo[]; strip: Photo[]; sections: Section[]; loose: Photo[]; href: string }

const byOrd = (a: Photo, b: Photo) => (a.ord ?? 0) - (b.ord ?? 0);
const manual = (list: Photo[], key: (p: Photo) => number | undefined) => list.filter((p) => key(p) !== undefined).sort((a, b) => key(a)! - key(b)!);
/** Las que tienen posición manual, en ese orden; después el resto tal cual. */
const manualFirst = (list: Photo[], key: (p: Photo) => number | undefined) => [...manual(list, key), ...list.filter((p) => key(p) === undefined)];
/** Fila del hover: las del orden manual si existe; si no, todas. */
const stripOf = (list: Photo[], key: (p: Photo) => number | undefined) => { const m = manual(list, key); return m.length ? m : list; };

const map = new Map<string, Work>();
for (const p of photos) {
  if (p.cat !== 'work' || !p.work) continue;
  let w = map.get(p.work);
  if (!w) { w = { slug: p.work, name: p.workName || p.work, order: p.workOrder ?? 999, photos: [], strip: [], sections: [], loose: [], href: `/works/${p.work}` }; map.set(p.work, w); }
  if (p.section) {
    let sec = w.sections.find((x) => x.slug === p.section);
    if (!sec) { sec = { slug: p.section, name: p.sectionName || p.section, order: p.sectionOrder ?? 999, photos: [], strip: [], href: `/works/${p.work}/${p.section}` }; w.sections.push(sec); }
    sec.photos.push(p);
  } else w.loose.push(p);
}
export const works: Work[] = [...map.values()]
  .map((w) => {
    w.sections.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const sec of w.sections) { sec.photos.sort(byOrd); sec.strip = stripOf(sec.photos, (p) => p.ordS); sec.photos = manualFirst(sec.photos, (p) => p.ordS); }
    w.loose.sort(byOrd);
    const all = [...w.sections.flatMap((sec) => sec.photos), ...w.loose];
    w.strip = stripOf(all, (p) => p.ordW);          // hover general en /works
    w.photos = manualFirst(all, (p) => p.ordW);     // mosaico (works sin colecciones)
    return w;
  })
  .filter((w) => w.photos.length > 0)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

/** Nombre de work/colección en formato normal para Google (en la web siguen en mayúsculas): «PORSCHE x SCRAPWORLD» → «Porsche x Scrap World». */
const KEEP = new Set(['NYC', 'FC', 'FW', 'SS', 'SW', 'AW', 'DJ']);
const FIX: Record<string, string> = { Scrapworld: 'Scrap World', Minishopmadrid: 'Minishopmadrid', Co: 'Co.' };
export function seoName(name: string) {
  return name.split(/\s+/).map((w) => {
    const m = w.match(/^([A-Za-zÀ-ÿ]+)(\d+)$/);  // SUMMER22 → Summer 22, FW22 → FW22
    if (m && !KEEP.has(m[1].toUpperCase())) return `${seoName(m[1])} ${m[2]}`;
    if (w === 'x' || w === 'X' || w === '&' || /^\d/.test(w) || KEEP.has(w.replace(/\d+$/, '').toUpperCase())) return w === 'X' ? 'x' : w;
    const t = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return FIX[t] ?? t;
  }).join(' ');
}
