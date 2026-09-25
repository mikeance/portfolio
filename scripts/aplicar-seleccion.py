#!/usr/bin/env python3
"""Aplica la última exportación del catálogo (~/Downloads/seleccion-fotos*.json) a la web y al catálogo.

- Copia (clona) los originales seleccionados a fotos/<categoría>/<proyecto>/ (una foto puede ir a varias categorías).
- Portada ordenada en fotos/portada/001_… y títulos en fotos/titulos.json.
- Actualiza catalogo/preseleccion.json, portada.json, titulos.json y oculta lo no marcado (ocultas.json).

Uso: python3 scripts/aplicar-seleccion.py [ruta/al/export.json] [--no-ocultar] [--previo estado-anterior.json]
- Marca «W» (seleccion.W): foto en la web sin categoría (solo en works o en la portada); la usa la app Estudio.
- --previo: estado publicado anterior; lo que estaba en la web y ya no está sale también de works.
Después: node scripts/prepare-photos.mjs && node scripts/catalog.mjs && npm run build && npx wrangler deploy
"""
import glob, json, os, re, shutil, subprocess, sys

FOTO = os.path.expanduser('~/Desktop/FOTO')
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(W, 'catalogo')
NAME = {'P': 'faces', 'E': 'editorial', 'L': 'lifestyle'}
# Retoques (retoques.json): la web usa la versión retocada en lugar del original (el catálogo sigue con el original)
RETOQ = {k: v for k, v in json.load(open(os.path.join(W, 'retoques.json'))).items() if not k.startswith('_')} if os.path.exists(os.path.join(W, 'retoques.json')) else {}
def srcpath(p):
    r = RETOQ.get(p)
    q = os.path.join(FOTO, r['retocada']) if r else None
    return q if q and os.path.exists(q) else os.path.join(FOTO, p)

previo = sys.argv[sys.argv.index('--previo') + 1] if '--previo' in sys.argv else None
args = [a for a in sys.argv[1:] if not a.startswith('--') and a != previo]
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
works = {p: w for p, w in d.get('works', {}).items() if p in sel}
orden = {k: [p for p in v if p in sel or k.startswith(('W:', 'V:'))] for k, v in d.get('orden', {}).items() if v}  # orden manual de Faces (P) / Life (L) / works: página (W:) y hover (V:)
work_of = {p: w for p, w in d.get('workOf', {}).items() if p in sel}  # work elegido en catalogo/textos.html ('' = ninguno: se saca de las carpetas)
print('marcas:', {k: len(v) for k, v in d['seleccion'].items()}, '· fotos:', len(sel), '· ✕:', len(d['descartadas']), '· portada:', len(portada), '· títulos:', len(titles), '· works manuales:', len(works))

pre = dict(sel)
pre.update({p: 'X' for p in d['descartadas']})
json.dump(pre, open(os.path.join(CAT, 'preseleccion.json'), 'w'), ensure_ascii=False)
json.dump(portada, open(os.path.join(CAT, 'portada.json'), 'w'), ensure_ascii=False)
json.dump(titles, open(os.path.join(CAT, 'titulos.json'), 'w'), ensure_ascii=False)
json.dump(works, open(os.path.join(CAT, 'works.json'), 'w'), ensure_ascii=False)
json.dump(orden, open(os.path.join(CAT, 'orden.json'), 'w'), ensure_ascii=False)

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

prev_origen_p = os.path.join(W, 'fotos', 'origen.json')
prev_on_web = set(json.load(open(prev_origen_p)).values()) if os.path.exists(prev_origen_p) else set()  # fotos que estaban en la web antes de este export
if previo and os.path.exists(previo):  # también las que solo estaban en works / portada
    prev_on_web |= {x for v in json.load(open(previo)).get('seleccion', {}).values() for x in v}
n, seen, web_titles, web_works, origen = 0, set(), {}, {}, {}
for p, ks in sel.items():
    src = srcpath(p)
    if not os.path.exists(src):
        print('  no existe:', p); continue
    for k in ks:
        if k not in NAME: continue  # «W»: sin categoría (solo works / portada)
        dest = dest_for(p, NAME[k])
        if dest in seen: continue
        seen.add(dest); os.makedirs(os.path.dirname(dest), exist_ok=True)
        if subprocess.run(['cp', '-pc', src, dest]).returncode == 0: n += 1
        rel = os.path.relpath(dest, os.path.join(W, 'fotos'))
        origen[rel] = p
        if p in titles: web_titles[rel] = titles[p]
        if p in works: web_works[rel] = works[p]
for i, p in enumerate(portada, 1):
    src = srcpath(p)
    if os.path.exists(src):
        dest = dest_for(p, 'portada', f'{i:03d}_')
        subprocess.run(['cp', '-pc', src, dest])
        if p in titles: web_titles[os.path.relpath(dest, os.path.join(W, 'fotos'))] = titles[p]
json.dump(web_titles, open(os.path.join(W, 'fotos', 'titulos.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(web_works, open(os.path.join(W, 'fotos', 'works.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(origen, open(os.path.join(W, 'fotos', 'origen.json'), 'w'), ensure_ascii=False)
web_orden = {NAME[k]: [os.path.relpath(dest_for(p, NAME[k]), os.path.join(W, 'fotos')) for p in v if k in sel.get(p, '')] for k, v in orden.items() if k in NAME}
json.dump(web_orden, open(os.path.join(W, 'fotos', 'orden.json'), 'w'), ensure_ascii=False)
print('orden manual:', {k: len(v) for k, v in web_orden.items()} or 'ninguno (automático)')
print('web:', n, 'copias · portada:', len(portada), '· títulos:', len(web_titles))
for c in NAME.values():
    b = os.path.join(W, 'fotos', c)
    print(f'  {c}: {sum(len(x) for _, _, x in os.walk(b))} fotos en {len(os.listdir(b))} proyectos')

# ---- WORKS: la foto elegida en textos.html se coloca (clon) en su carpeta fotos/works/<NN NOMBRE>; si estaba en otra, se quita
import hashlib, unicodedata
WORKS = os.path.join(W, 'fotos', 'works')
def slugify(t):
    t = unicodedata.normalize('NFD', t); t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', t))
def sha(path):
    h = hashlib.sha1()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()[:12]
_sha_memo = {}
def sha_of(path):
    if path not in _sha_memo: _sha_memo[path] = sha(path)
    return _sha_memo[path]
orden_works = {k[2:]: v for k, v in orden.items() if k.startswith('W:')}  # orden de la página de cada work/colección ('W:<slug>')
orden_hovers = {k[2:]: v for k, v in orden.items() if k.startswith('V:')}  # fila del hover de cada work/colección ('V:<slug>'), independiente
if (work_of or orden_works or orden_hovers) and os.path.isdir(WORKS):
    folders = {}  # slug ('work' o 'work/seccion') -> ruta relativa a fotos/works
    def finfo(n):
        m = re.match(r'^(\d+)\s*[-._]?\s*(.+)$', n); return slugify((m.group(2) if m else n).strip())
    for name in sorted(os.listdir(WORKS)):
        if name.startswith('.') or not os.path.isdir(os.path.join(WORKS, name)): continue
        folders[finfo(name)] = name
        for sub in sorted(os.listdir(os.path.join(WORKS, name))):
            if sub.startswith('.') or not os.path.isdir(os.path.join(WORKS, name, sub)): continue
            folders[finfo(name) + '/' + finfo(sub)] = os.path.join(name, sub)
    # contenido actual de las carpetas (por sha), con caché
    cache_p = os.path.join(CAT, 'works-sha.json')
    cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    def scan():
        present = {}  # sha -> [(slug, path)]
        for slug, name in folders.items():
            for fn in os.listdir(os.path.join(WORKS, name)):
                fp = os.path.join(WORKS, name, fn)
                if fn.startswith('.') or not os.path.isfile(fp): continue
                key = fp + '|' + str(os.path.getmtime(fp)) + '|' + str(os.path.getsize(fp))
                h = cache.get(key) or sha(fp); cache[key] = h
                present.setdefault(h, []).append((slug, fp))
        json.dump(cache, open(cache_p, 'w'))
        return present
    present = scan()
    added = removed = 0; missing = set()
    # fotos con retoque: fuera las copias del original que queden en works (se usan las retocadas)
    for p in RETOQ:
        orig = os.path.join(FOTO, p)
        if srcpath(p) != orig and os.path.exists(orig):
            for s2, fp in present.get(sha_of(orig), []):
                if os.path.exists(fp): os.remove(fp); removed += 1
    if removed: present = scan()
    for p, slug in work_of.items():
        if slug and slug not in folders: missing.add(slug); continue
        src = srcpath(p)
        if not os.path.exists(src): continue
        h = sha_of(src)
        for s2, fp in present.get(h, []):
            if s2 != slug and os.path.exists(fp): os.remove(fp); removed += 1
        if slug and not any(s2 == slug for s2, _ in present.get(h, [])):
            parts = p.split('/'); proj = clean(parts[1]) if re.match(r'20\d\d$', parts[0]) and len(parts) > 2 else ' - '.join(parts[:min(len(parts) - 1, 3)])
            proj = re.sub(r'^EQUIPO ANTERIOR - ', '', proj)
            dest = os.path.join(WORKS, folders[slug], f"{proj} - {parts[-1]}")
            subprocess.run(['cp', '-pc', src, dest]); added += 1
            if p in titles: web_titles[os.path.relpath(dest, os.path.join(W, 'fotos'))] = titles[p]
    # fotos que han dejado de estar en la web (descartadas ✕ o sin marcas): fuera también de todas las carpetas de works.
    # Las que solo existen como archivos sueltos en works (nunca estuvieron en la web por el catálogo) no se tocan.
    gone = (prev_on_web - set(sel)) | set(d.get('descartadas', []))
    gone_shas = {sha_of(srcpath(p)) for p in gone if os.path.exists(srcpath(p))}
    for h, lst in present.items():
        if h not in gone_shas: continue
        for s2, fp in lst:
            if os.path.exists(fp): os.remove(fp); removed += 1
    if added or removed: present = scan()
    # títulos también para las copias ya existentes en works
    for p, t in titles.items():
        src = srcpath(p)
        if os.path.exists(src):
            for s2, fp in present.get(sha_of(src), []): web_titles[os.path.relpath(fp, os.path.join(W, 'fotos'))] = t
    json.dump(web_titles, open(os.path.join(W, 'fotos', 'titulos.json'), 'w'), ensure_ascii=False, indent=1)
    if work_of: print('works: añadidas', added, '· quitadas', removed, ('· carpetas que no existen: ' + ', '.join(sorted(missing))) if missing else '')
    # orden manual de works / colecciones -> fotos/orden-works.json { slug: [rutas relativas a fotos/] }
    def rutas(ordenes):
        out = {}
        for slug, lst in ordenes.items():
            if slug not in folders: continue
            paths = []
            for p in lst:
                src = srcpath(p)
                if not os.path.exists(src): continue
                for s2, fp in present.get(sha_of(src), []):
                    rel = os.path.relpath(fp, os.path.join(W, 'fotos'))
                    if (s2 == slug or s2.startswith(slug + '/')) and rel not in paths: paths.append(rel)
            if paths: out[slug] = paths
        return out
    web_ow, web_oh = rutas(orden_works), rutas(orden_hovers)
    json.dump(web_ow, open(os.path.join(W, 'fotos', 'orden-works.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(web_oh, open(os.path.join(W, 'fotos', 'orden-hovers.json'), 'w'), ensure_ascii=False, indent=1)
    if web_ow: print('orden works:', {k: len(v) for k, v in web_ow.items()})
    if web_oh: print('hovers:', {k: len(v) for k, v in web_oh.items()})
