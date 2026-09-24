// Escribe catalogo/orden-auto.json: el orden automático actual de FACES, EDITORIAL y LIFE (el mismo que usa la web)
// expresado con las rutas originales de FOTO, para que los editores de orden del catálogo partan de él.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const { photos, sortLife, sortFaces, sortByColor } = await import(join(ROOT, 'src/lib/photos.ts'));
const origenPath = join(ROOT, 'fotos/origen.json');
if (!existsSync(origenPath)) { console.log('ℹ sin fotos/origen.json: no se genera el orden automático'); process.exit(0); }
const origen = JSON.parse(readFileSync(origenPath, 'utf8'));
const toOrig = (list) => [...new Set(list.map((p) => origen[p.src]).filter(Boolean))];
const out = {
  P: toOrig(sortFaces(photos.filter((p) => p.cat === 'faces'))),
  E: toOrig(sortByColor(photos.filter((p) => p.cat === 'editorial'))),
  L: toOrig(sortLife(photos.filter((p) => p.cat === 'lifestyle'))),
};
writeFileSync(join(ROOT, 'catalogo/orden-auto.json'), JSON.stringify(out));
console.log(`✔ orden automático: Faces ${out.P.length} · Editorial ${out.E.length} · Life ${out.L.length}`);
