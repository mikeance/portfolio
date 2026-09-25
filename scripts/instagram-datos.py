#!/usr/bin/env python3
"""Genera catalogo/instagram-data.js para el editor de Instagram (catalogo/instagram.html).

Fuentes: src/data/photos.json (fotos de la web), src/data/faces.json (caras), catalogo/cache.json (nitidez),
catalogo/instagram-publicadas.json (ids ya publicados en Instagram, sacados de la exportación de la cuenta)
y la exportación de Instagram en ~/Desktop/RRSS (para la vista previa del perfil).

El plan que carga el editor es catalogo/instagram-plan.json (el último export aplicado). Si no existe, o con
--propuesta, se genera una propuesta automática: carruseles cortos (4-6 fotos) con la foto más impactante de
cada grupo como portada.

Uso: python3 scripts/instagram-datos.py [--propuesta]
"""
import json, os, re, sys, math, glob, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'catalogo')
J = lambda *p: json.load(open(os.path.join(ROOT, *p)))
RRSS = os.path.expanduser('~/Desktop/RRSS')

photos = J('src/data/photos.json')
faces = J('src/data/faces.json')
cache = J('catalogo/cache.json')
pub = set(J('catalogo/instagram-publicadas.json'))

# --- una entrada por foto -------------------------------------------------------------------------
sharp_by_size = {}
for v in cache.values(): sharp_by_size.setdefault(v['size'], v.get('sharp', 0))

def stock(src):
    m = re.search(r'(Portra[ _]?\d+|Ektar[ _]?\d+|Gold[ _]?\d+|HP5|TriX[ _]?\d*|TMax[ _]?\d+|Delta[ _]?\d+|VISION3[ _]500T|ultramax ?400)', src, re.I)
    if not m: return ''
    s = m.group(1).replace('_', ' ')
    s = re.sub(r'(?i)^portra', 'Portra', s); s = re.sub(r'(?i)^tri ?x', 'Tri-X', s); s = re.sub(r'(?i)^tmax', 'T-Max', s)
    s = re.sub(r'(?i)^vision3', 'Vision3', s); s = re.sub(r'(?i)^ultramax ?', 'Ultramax ', s)
    return s

info = {}
for n, p in enumerate(photos):
    e = info.setdefault(p['id'], dict(id=p['id'], t='', proj='', src=p['src'], r=p['ratio'], cats=[], works=[], wslug='', home=None, sat=p.get('sat', 0), lum=p.get('lum', .5)))
    if p.get('title'): e['t'] = p['title']
    if p.get('proj'): e['proj'] = p['proj']
    if p['cat'] not in e['cats']: e['cats'].append(p['cat'])
    if p.get('work'): e['works'].append(p.get('workName', p['work']) + (' › ' + p['sectionName'] if p.get('sectionName') else ''))
    if p.get('work') and not e['wslug']: e['wslug'] = p['work']
    if p['cat'] == 'home' and e['home'] is None: e['home'] = n

home_rank = {i: k for k, i in enumerate(sorted((e['id'] for e in info.values() if e['home'] is not None), key=lambda i: info[i]['home']))}

def score(e):
    """Impacto como portada (0-100): vertical, cara protagonista, nítida, elegida para la portada de la web."""
    s = 0.0
    r = e['r']
    s += 30 if r <= 0.85 else (12 if r <= 1.05 else 0)                   # en 4:5 una horizontal queda pequeña
    f = faces.get(e['id'], {})
    fa = f.get('max', 0) if f.get('n') else 0
    s += min(28, fa * 280) if fa < 0.35 else 22                           # retrato: cara grande = impacto
    try: fs = os.path.getsize(os.path.join(ROOT, 'fotos', e['src']))
    except OSError: fs = None
    sh = sharp_by_size.get(fs, 0)
    s += max(0, min(14, (math.log10(sh + 1) - 2) * 9))                      # nitidez
    if e['id'] in home_rank: s += 18 - 8 * home_rank[e['id']] / max(1, len(home_rank))   # está en la portada de la web
    s += min(6, e['sat'] * 30)                                            # algo de color
    if 'faces' in e['cats']: s += 4
    return round(min(100, s))

for e in info.values():
    e['s'] = score(e)
    e['st'] = stock(e['src'])
    e['pub'] = 1 if e['id'] in pub else 0

# --- grupos: persona, lugar o trabajo --------------------------------------------------------------
WORKRX = re.compile(r'\bx\b|^SW\b|Galag|Real Madrid|Cut & Sew|Jumi|Teen Room|Keychain|Peldanyos|Home Run|Hola Coffee|Eddmond|Abdul', re.I)
TAGS = {  # usuarios que ya aparecen en tus pies de foto antiguos; el resto, a confirmar
    'Jamal': '@jamalfarrukk', 'Sebas': '@sebasmartz', 'Pacome': '@pacomepegaz', 'Laura': '@lauravecu', 'Roberwido': '@roberwidoll',
    'ByCalitos': '@bycalitos_official', 'Hola Coffee': '@holacoffee @minishopmadrid', 'Eddmond': '@edmmond @minishopmadrid',
    'Sebago': '@sebago_world @minishopmadrid', 'Real Madrid': '@adidas_es @realmadrid', 'Clockers': '@clockers.store', 'Sabi': '@giaansta',
}
def group_of(e):
    t = e['t']
    if not t: return ('Works', 'Sebago x Mini' if 'SEBAGO' in e['src'].upper() else 'Minishop')
    subj, _, rest = t.partition(' · ')
    if not rest:  # «Porto, 2023» → lugar
        return ('Lugares', re.sub(r',\s*\d{4}$', '', subj))
    if subj == 'Unknown': return ('Lugares', re.sub(r',\s*\d{4}$', '', rest))
    subj = subj.replace(',s ', '’s ')
    if WORKRX.search(subj):
        subj = re.sub(r'^SW ?(Summer|Spring|Winter|FW|SS)\s?(\d\d)$', r'SW \1 \2', subj)
        return ('Works', subj)
    return ('Serie', subj)

def place_year(ids):
    places = collections.Counter(); years = set()
    for i in ids:
        t = info[i]['t']; m = re.search(r'(?:· )?([^·]*?),\s*(\d{4})$', t)
        if m: places[m.group(1).strip()] += 1; years.add(int(m.group(2)))
    pl = ' y '.join(p for p, _ in places.most_common(2)) if places else ''
    ys = sorted(years); yr = (f'{ys[0]}–{ys[-1]}' if ys and ys[0] != ys[-1] else (str(ys[0]) if ys else ''))
    return pl, yr

def caption(title, pillar, ids):
    pl, yr = place_year(ids)
    stocks = [s for s, _ in collections.Counter(filter(None, (info[i]['st'] for i in ids))).most_common(2)]
    head = title if pillar == 'Lugares' else f'{title} · {pl}'.strip(' ·')
    if pillar == 'Lugares' and not re.search(r'\d{4}', title): head = f'{title}, {yr}' if yr else title
    elif yr and not re.search(r'\d{4}', head): head += f', {yr}'
    return f"{head} · 35mm{(' · ' + ' / '.join(stocks)) if stocks else ''}\n→ mikeance.com"

def link(pillar, ids):
    e = info[ids[0]]
    pref = {'Serie': 'faces', 'Lugares': 'lifestyle'}.get(pillar)
    if pref and pref in e['cats']: return f'https://mikeance.com/photography/{pref}'
    if e['wslug']:
        return f"https://mikeance.com/works/{e['wslug']}"
    cat = next((c for c in ('faces', 'editorial', 'lifestyle') if c in e['cats']), 'editorial')
    return f'https://mikeance.com/photography/{cat}'

def propuesta():
    pool = [e for e in info.values() if not e['pub']]
    groups = collections.defaultdict(list)
    for e in pool: groups[group_of(e)].append(e['id'])
    # personas con menos de 3 fotos → «Retratos, <año>»
    for (pil, name), ids in list(groups.items()):
        if pil == 'Serie' and len(ids) < 3:
            del groups[(pil, name)]
            for i in ids:
                y = re.search(r'(\d{4})$', info[i]['t']); groups[('Serie', f'Retratos {y.group(1) if y else ""}'.strip())].append(i)
        elif pil in ('Lugares', 'Works') and len(ids) < 3:
            del groups[(pil, name)]
            for i in ids: groups[(pil, 'Varios' if pil == 'Works' else 'Rincones')].append(i)
    posts = []
    for (pil, name), ids in groups.items():
        ids.sort(key=lambda i: -info[i]['s'])
        n = len(ids)
        k = max(1, round(n / 5))
        covers = [i for i in ids if info[i]['r'] <= 1.05][:k] or ids[:1]
        k = len(covers)
        rest = [i for i in ids if i not in covers]
        buckets = [[c] for c in covers]
        # reparto en serpentina para que todos los posts tengan fotos buenas
        for j, i in enumerate(rest):
            rnd, pos = divmod(j, k); b = pos if rnd % 2 == 0 else k - 1 - pos
            buckets[b].append(i)
        for b in buckets:  # dentro del post: portada, luego alterna fuerte/flojo pero la 2.ª siempre fuerte
            head, tail = b[0], sorted(b[1:], key=lambda i: -info[i]['s'])
            b[:] = [head] + tail
        for m, b in enumerate(buckets):
            if len(b) < 3 and m:  # restos pequeños al post anterior del grupo
                buckets[m - 1].extend(b); b.clear()
        buckets = [b for b in buckets if b]
        for m, b in enumerate(buckets):
            roman = ['', ' (I)', ' (II)', ' (III)', ' (IV)', ' (V)', ' (VI)'][m + 1] if len(buckets) > 1 else ''
            posts.append(dict(pilar=pil, grupo=name, titulo=name + roman, fotos=b))
    # lanzamiento: las 8 portadas más fuertes de grupos distintos (salen de su post; ese post coge la siguiente mejor)
    by = sorted(posts, key=lambda p: -info[p['fotos'][0]]['s'])
    launch, seen = [], set()
    for p in by:
        if p['grupo'] in seen or len(p['fotos']) < 4: continue
        seen.add(p['grupo']); launch.append(p['fotos'].pop(0))
        p['fotos'].sort(key=lambda i: (info[i]['r'] > 1.05, -info[i]['s']))
        if len(launch) == 8: break
    # orden: alterna pilares y no repite grupo en al menos 6 posts; lo más fuerte primero
    queues = {k: sorted([p for p in posts if p['pilar'] == k], key=lambda p: -info[p['fotos'][0]]['s']) for k in ('Serie', 'Works', 'Lugares')}
    seq, recent = [], []
    cycle = ['Serie', 'Works', 'Lugares']
    while any(queues.values()):
        for pil in cycle:
            q = queues[pil]
            if not q: continue
            pick = next((p for p in q if p['grupo'] not in recent[-6:]), q[0])
            q.remove(pick); seq.append(pick); recent.append(pick['grupo'])
    seq.insert(0, dict(pilar='Lanzamiento', grupo='mikeance.com', titulo='mikeance.com', fotos=launch,
                       pie='Nueva web. Ocho años de fotos en 35mm, casi todas inéditas.\nEditorial · Faces · Life · Works\n→ mikeance.com (enlace en la bio)',
                       etiquetas='@aulagalab (colaborativo solo si aceptan)', nota='Última diapositiva: captura de la web.'))
    for p in seq:
        p.setdefault('pie', caption(p['grupo'], p['pilar'], p['fotos']))
        p.setdefault('etiquetas', ' '.join(v for k, v in TAGS.items() if k.lower() in p['grupo'].lower()) + (' @scrapworld' if re.search(r'^SW|x SW|Scrap', p['grupo']) else ''))
        p.setdefault('nota', '')
        p.setdefault('enlace', 'https://mikeance.com' if p['pilar'] == 'Lanzamiento' else link(p['pilar'], p['fotos']))
        p.pop('grupo', None)
    return dict(inicio='2026-10-01', dias=[1, 3, 5], posts=seq)

# --- plan -----------------------------------------------------------------------------------------
PLAN = os.path.join(CAT, 'instagram-plan.json')
if '--propuesta' in sys.argv or not os.path.exists(PLAN):
    plan = propuesta(); plan['origen'] = 'propuesta ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    json.dump(plan, open(PLAN, 'w'), ensure_ascii=False, indent=1)
plan = json.load(open(PLAN))

# --- vista previa del perfil: posts actuales que se quedan (2019-2024, sin los que se archivan) -------
grid = []
exp = sorted(glob.glob(os.path.join(RRSS, 'instagram-*')))
if exp:
    raw = json.load(open(os.path.join(exp[-1], 'your_instagram_activity/media/posts_1.json')))
    ARCHIVAR = {24, 25, 27} | set(range(38, 200))
    for k, x in enumerate(raw):
        if k in ARCHIVAR: continue
        m = next((m for m in x['media'] if not m['uri'].endswith('.mp4')), None)
        if not m: continue
        ts = x.get('creation_timestamp') or x['media'][0]['creation_timestamp']
        t = (x.get('title') or x['media'][0].get('title') or '')
        try: t = t.encode('latin-1').decode('utf-8')
        except Exception: pass
        grid.append(dict(src=os.path.relpath(os.path.join(exp[-1], m['uri']), CAT), fecha=datetime.date.fromtimestamp(ts).isoformat(), t=t.split('\n')[0][:60], n=len(x['media'])))

keep = ('id', 't', 'proj', 'r', 'cats', 'works', 's', 'st', 'pub')
data = dict(generado=datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), fotos=[{k: e[k] for k in keep} for e in info.values()], plan=plan, perfil=grid)
open(os.path.join(CAT, 'instagram-data.js'), 'w').write('window.IG=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
n = len(plan['posts']); f = sum(len(i.split('+')) for p in plan['posts'] for i in p['fotos'])
print(f"instagram-data.js: {len(info)} fotos ({sum(e['pub'] for e in info.values())} ya publicadas), plan «{plan.get('origen', '')}» con {n} posts y {f} fotos")
