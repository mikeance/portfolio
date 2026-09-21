import defs from '../data/works.json';
import { photos, type Photo } from './photos';

export interface Session { name: string; label: string; year: string; photos: Photo[] }
export interface Work { slug: string; name: string; photos: Photo[]; sessions: Session[]; cover: Photo[] }

/** "2024-07 SW Summer 24" -> etiqueta "SW Summer 24", año "2024" */
const labelOf = (proj: string) => proj.replace(/^\d{4}-\d{2}\s*/, '').replace(/^EQUIPO ANTERIOR - /, '');
const yearOf = (proj: string) => (proj.match(/^(\d{4})/) || [])[1] || '';

export const works: Work[] = defs
  .map((w) => {
    const seen = new Set<string>();
    const list = photos.filter((p) => p.works?.includes(w.slug) && p.sha && !seen.has(p.sha) && seen.add(p.sha));
    const byProj = new Map<string, Photo[]>();
    for (const p of list) byProj.set(p.proj || '', [...(byProj.get(p.proj || '') || []), p]);
    // sesiones de más reciente a más antigua; las carpetas sin fecha (EQUIPO ANTERIOR…) al final
    const key = (n: string) => (/^\d{4}-\d{2}/.test(n) ? '1' + n : '0' + n);
    const sessions = [...byProj].sort((a, b) => key(b[0]).localeCompare(key(a[0]))).map(([name, ph]) => ({ name, label: labelOf(name), year: yearOf(name), photos: ph }));
    const cover = sessions.flatMap((s) => s.photos).slice(0, 4);
    return { slug: w.slug, name: w.name, photos: list, sessions, cover };
  })
  .filter((w) => w.photos.length > 0);
