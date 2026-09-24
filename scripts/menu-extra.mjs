// Palabras del menú que no están en «menu web.svg» (ABOUT). Se componen con la misma tipografía que el resto del
// menú (Helvetica Neue, mismo alto de mayúsculas y espaciado; comprobado letra a letra con EDITORIAL y CONTACT) y la
// pose «descolocada» sigue el patrón del diseño de Miguel: primera y última letra quietas, las de en medio giradas.
// Uso: node scripts/menu-extra.mjs   (necesita swiftc; compila scripts/menu/glyphs.swift en .cache/glyphs)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, '.cache/glyphs');
if (!existsSync(BIN)) { mkdirSync(join(ROOT, '.cache'), { recursive: true }); execFileSync('swiftc', ['-O', join(ROOT, 'scripts/menu/glyphs.swift'), '-o', BIN]); }
const WORDS = [
  // giro (grados) y desplazamiento vertical de cada letra en la pose descolocada
  { key: 'about', text: 'ABOUT', pose: [[0, 0], [-13, -2], [8, 3], [-15, -1], [0, 0]] },
];
const out = [];
for (const w of WORDS) {
  const g = JSON.parse(execFileSync(BIN, ['HelveticaNeue', w.text, '30.7'], { encoding: 'utf8' })).glyphs;
  const X = 181.6, Y = 440;                                       // mismo arranque que las demás palabras del menú
  const shift = (d) => d.replace(/(-?\d+\.\d+),(-?\d+\.\d+)/g, (_, x, y) => `${(+x + X).toFixed(2)},${(+y + Y).toFixed(2)}`);
  const letters = g.map((gl, i) => {
    const [x0, y0, x1, y1] = gl.bb, cx = (x0 + x1) / 2 + X, cy = (y0 + y1) / 2 + Y;
    const [deg, dy] = w.pose[i], t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    // matriz CSS con origen en (0,0): gira la letra sobre su centro y la desplaza dy
    const m = [c, s, -s, c, cx - (c * cx - s * cy), cy + dy - (s * cx + c * cy)].map((v) => +v.toFixed(3));
    return { d: shift(gl.d), m, bb: [x0 + X, y0 + Y, x1 + X, y1 + Y] };
  });
  const PAD = 6, x0 = Math.min(...letters.map((l) => l.bb[0])), y0 = Math.min(...letters.map((l) => l.bb[1]));
  const x1 = Math.max(...letters.map((l) => l.bb[2])), y1 = Math.max(...letters.map((l) => l.bb[3]));
  out.push({ key: w.key, vb: [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD].map((v) => +v.toFixed(1)), letters: letters.map(({ d, m }) => ({ d, m })) });
  console.log(`${w.key}: ${letters.length} letras · ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}`);
}
writeFileSync(join(ROOT, 'src/data/menu-extra.json'), JSON.stringify(out));
console.log('✔ src/data/menu-extra.json');
