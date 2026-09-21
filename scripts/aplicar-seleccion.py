#!/usr/bin/env python3
"""Aplica la última exportación del catálogo (~/Downloads/seleccion-fotos*.json) a la web y al catálogo.

- Copia (clona) los originales seleccionados a fotos/<categoría>/<proyecto>/ (una foto puede ir a varias categorías).
- Portada ordenada en fotos/portada/001_… y títulos en fotos/titulos.json.
- Actualiza catalogo/preseleccion.json, portada.json, titulos.json y oculta lo no marcado (ocultas.json).

Uso: python3 scripts/aplicar-seleccion.py [ruta/al/export.json] [--no-ocultar]
Después: node scripts/prepare-photos.mjs && node scripts/catalog.mjs && npm run build && npx wrangler deploy
"""
import glob, json, os, re, shutil, subprocess, sys

FOTO = os.path.expanduser('~/Desktop/FOTO')
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(W, 'catalogo')
NAME = {'P': 'faces', 'E': 'editorial', 'L': 'lifestyle'}

args = [a for a in sys.argv[1:] if not a.startswith('--')]
f = args[0] if args else max(glob.glob(os.path.expanduser('~/Downloads/seleccion-fotos*.json')), key=os.path.getmtime)
d = json.load(open(f))
print('usando:', os.path.basename(f), d['exportado'])

# marcas: una foto puede estar en varias categorías -> "PE", "L", "X"...
sel = {}
for k, v in d['seleccion'].items():
    for p in v:
        sel[p] = sel.get(p, '') + k
titles = {p: t for p, t in d.get('titulos', {}).items() if p in sel}
portada = [p for p in d.get('portada', []) if p in sel]
print('marcas:', {k: len(v) for k, v in d['seleccion'].items()}, '· fotos:', len(sel), '· ✕:', len(d['descartadas']), '· portada:', len(portada), '· títulos:', len(titles))

pre = dict(sel)
pre.update({p: 'X' for p in d['descartadas']})
json.dump(pre, open(os.path.join(CAT, 'preseleccion.json'), 'w'), ensure_ascii=False)
json.dump(portada, open(os.path.join(CAT, 'portada.json'), 'w'), ensure_ascii=False)
json.dump(titles, open(os.path.join(CAT, 'titulos.json'), 'w'), ensure_ascii=False)

if '--no-ocultar' not in sys.argv:
    cat = json.load(open(os.path.join(CAT, 'catalogo.json')))['photos']
    old = set(json.load(open(os.path.join(CAT, 'ocultas.json'))))
    new = [p['p'] for p in cat if p['p'] not in pre and p['p'] not in old]
    hide = sorted(old | set(new))
    assert not any(p in pre for p in hide)
    json.dump(hide, open(os.path.join(CAT, 'ocultas.json'), 'w'), ensure_ascii=False)
    print('ocultas nuevas:', len(new), '· total ocultas:', len(hide))

# carpetas de la web
for c in list(NAME.values()) + ['portada']:
    dst = os.path.join(W, 'fotos', c)
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)

clean = lambda s: re.sub(r'\s*\[de Fotos\]', '', re.sub(r'\s*\(#\d+\)', '', s)).strip()

def dest_for(p, c, prefix=''):
    parts = p.split('/')
    if re.match(r'20\d\d$', parts[0]) and len(parts) > 2:
        proj, rest = clean(parts[1]), '_'.join(parts[2:])
    else:
        cut = min(len(parts) - 1, 3)
        proj, rest = ' - '.join(parts[:cut]), '_'.join(parts[cut:]) or parts[-1]
    if c == 'portada':
        return os.path.join(W, 'fotos', c, prefix + re.sub(r'\s+', '_', proj + '__' + rest))
    return os.path.join(W, 'fotos', c, proj, prefix + re.sub(r'\s+', '_', rest))

n, seen, web_titles = 0, set(), {}
for p, ks in sel.items():
    src = os.path.join(FOTO, p)
    if not os.path.exists(src):
        print('  no existe:', p); continue
    for k in ks:
        dest = dest_for(p, NAME[k])
        if dest in seen: continue
        seen.add(dest); os.makedirs(os.path.dirname(dest), exist_ok=True)
        if subprocess.run(['cp', '-pc', src, dest]).returncode == 0: n += 1
        if p in titles: web_titles[os.path.relpath(dest, os.path.join(W, 'fotos'))] = titles[p]
for i, p in enumerate(portada, 1):
    src = os.path.join(FOTO, p)
    if os.path.exists(src):
        dest = dest_for(p, 'portada', f'{i:03d}_')
        subprocess.run(['cp', '-pc', src, dest])
        if p in titles: web_titles[os.path.relpath(dest, os.path.join(W, 'fotos'))] = titles[p]
json.dump(web_titles, open(os.path.join(W, 'fotos', 'titulos.json'), 'w'), ensure_ascii=False, indent=1)
print('web:', n, 'copias · portada:', len(portada), '· títulos:', len(web_titles))
for c in NAME.values():
    b = os.path.join(W, 'fotos', c)
    print(f'  {c}: {sum(len(x) for _, _, x in os.walk(b))} fotos en {len(os.listdir(b))} proyectos')
