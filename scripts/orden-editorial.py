# Orden de EDITORIAL: mezcla (no por colores) priorizando nitidez, con el blanco y negro repartido a lo largo
# de la página, sin sesiones seguidas y sin repetir la portada (ni su arranque ni sus parejas de fotos vecinas).
# Prioriza lo mejor: 2021–2023 (año del texto de la foto), más los futbolistas de Adidas & Real Madrid y algunos
# retratos del Spot de Scrapworld; el resto de años baja sin desaparecer. Con --mantener-primera conserva la foto 1.
# Uso: python3 scripts/orden-editorial.py <export base.json> <salida.json> [semilla] [--mantener-primera]
# Escribe orden['E'] (rutas de FOTO) en la salida; se aplica con aplicar-seleccion.py como cualquier export.
import json, math, random, re, sys

ROOT = '/Users/miguel/Desktop/WEB'
BASE, OUT = sys.argv[1], sys.argv[2]
args = [a for a in sys.argv[3:] if not a.startswith('--')]
random.seed(int(args[0]) if args else 5)
KEEP_FIRST = '--mantener-primera' in sys.argv

d = json.load(open(BASE))
photos = json.load(open(f'{ROOT}/src/data/photos.json'))
origen = json.load(open(f'{ROOT}/fotos/origen.json'))       # ruta web -> ruta FOTO
cache = json.load(open(f'{ROOT}/catalogo/cache.json'))      # ruta FOTO -> nitidez, etc.
web = {origen[p['src']]: p for p in photos if p['cat'] == 'editorial' and p.get('src') in origen}
faces = json.load(open(f'{ROOT}/src/data/faces.json'))

MEJORES = range(2021, 2024)   # años fuertes
FUTBOL = re.compile(r'Adidas Real Madrid')
FUTBOLISTAS = re.compile(r'^(Vini|Eder|Real Madrid)')   # textos con jugadores (no los detalles «Madrid, 2024»)
SPOT = re.compile(r'Spot SW')
N_SPOT = 5                    # cuántos retratos del Spot suben
SLOTS_FUTBOL = [6, 24, 47]    # posiciones reservadas (1 = primera) para los futbolistas más nítidos
SLOTS_SPOT = [13, 36, 58]     # y para los retratos del Spot más nítidos

def year(p, w):
    m = re.search(r'(20\d\d)\s*$', w.get('title', ''))
    if m: return int(m.group(1))
    m = re.match(r'(20\d\d)/', p); return int(m.group(1)) if m else None

BW_MAX = 0.03          # croma medio por píxel por debajo del cual la foto es blanco y negro
TOP_PORTADA = 60       # las primeras de la portada no abren también Editorial
VECINAS = 3            # dos fotos a esta distancia o menos en la portada no van juntas aquí
VENTANA_SESION = 8     # no repetir sesión dentro de las últimas N fotos
VENTANA_PERSONA = 20   # ni la misma persona (texto antes de « · ») dentro de las últimas N

posH = {p: i for i, p in enumerate(d.get('portada', []))}

def session(p):
    parts = p.split('/')
    return parts[1] if re.match(r'20\d\d$', parts[0]) and len(parts) > 2 else '/'.join(parts[:3])

rows = []
for p in d['seleccion']['E']:
    w = web.get(p)
    if not w or p in d.get('descartadas', []): continue
    c = cache.get(p, {})
    who = w.get('title', '').split(' · ')[0].strip() if ' · ' in w.get('title', '') else ''
    rows.append(dict(p=p, s=session(p), who=who, y=year(p, w), title=w.get('title', ''), close=faces.get(w['id'], {}).get('max', 0) >= 0.04,
                     bw=w.get('chroma', 1) < BW_MAX, lum=w.get('lum', 0.5), hue=w.get('hue', 0),
                     sat=w.get('sat', 0), wide=w.get('ratio', 1) > 1.15,
                     sharp=math.log(max(c.get('sharp', 1), 1)), expo=-abs(w.get('lum', 0.5) - 0.5)))

def z(k):
    v = [r[k] for r in rows]; m = sum(v) / len(v); sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 or 1
    for r in rows: r['z' + k] = (r[k] - m) / sd
for k in ('sharp', 'sat', 'expo'): z(k)
# retratos del Spot que suben: los más nítidos
spot_up = {r['p'] for r in sorted([r for r in rows if SPOT.search(r['p']) and r['close']], key=lambda r: -r['zsharp'])[:N_SPOT]}
for r in rows:
    boost = 1.3 if r['y'] in MEJORES else -0.6
    if FUTBOL.search(r['p']) and FUTBOLISTAS.search(r['title']): boost = 1.3
    if r['p'] in spot_up: boost = 1.3
    r['boost'] = boost
    r['score'] = 0.55 * r['zsharp'] + 0.1 * r['zsat'] + 0.15 * r['zexpo'] + boost + random.gauss(0, 0.5)

N = len(rows); bw_rows = [r for r in rows if r['bw']]; n_bw = len(bw_rows)
# posiciones objetivo del blanco y negro, repartidas por toda la página (empezando pronto, no en la primera)
bw_slots = [round((k + 0.6) * N / n_bw) for k in range(n_bw)] if n_bw else []

def penalty(r, out, left):
    i = len(out); pen = 0.0
    # urgencia: las sesiones con muchas fotos pendientes se adelantan un poco para no acabar amontonadas al final
    pen -= 14.0 * left[r['s']] / max(1, len(rows) - i)
    recent = out[-VENTANA_SESION:]
    if any(x['s'] == r['s'] for x in recent): pen += 6.0                       # sesión repetida cerca
    if r['who'] and any(x['who'] == r['who'] for x in out[-VENTANA_PERSONA:]): pen += 4.0   # misma persona cerca
    if i < TOP_PORTADA and posH.get(r['p'], 1e9) < TOP_PORTADA: pen += 2.5     # no abrir igual que la portada
    if out and r['p'] in posH and out[-1]['p'] in posH and abs(posH[r['p']] - posH[out[-1]['p']]) <= VECINAS: pen += 3.0
    if out:
        prev = out[-1]
        dh = min(abs(r['hue'] - prev['hue']), 360 - abs(r['hue'] - prev['hue']))
        if abs(r['lum'] - prev['lum']) < 0.07 and dh < 25: pen += 1.2          # romper degradados de color/luz
        if r['wide'] and any(x['wide'] for x in out[-2:]): pen += 1.5          # horizontales separadas
        if r['close'] == prev['close']: pen += 0.5                              # alternar retrato / plano abierto
    return pen

rem_bw = sorted(bw_rows, key=lambda r: -r['score'])
rem_col = sorted([r for r in rows if not r['bw']], key=lambda r: -r['score'])
out = []
left = {}
for r in rows: left[r['s']] = left.get(r['s'], 0) + 1
futbolistas = sorted([r for r in rows if FUTBOL.search(r['p']) and FUTBOLISTAS.search(r['title'])], key=lambda r: -r['zsharp'])
spots = sorted([r for r in rows if r['p'] in spot_up], key=lambda r: -r['zsharp'])
forced = {}
for slot, r in zip(SLOTS_FUTBOL, futbolistas): forced[slot - 1] = r
for slot, r in zip(SLOTS_SPOT, spots): forced[slot - 1] = r
if KEEP_FIRST and d.get('orden', {}).get('E'):
    first = next((r for r in rows if r['p'] == d['orden']['E'][0]), None)
    if first:
        out.append(first); left[first['s']] -= 1
        (rem_bw if first['bw'] else rem_col).remove(first)
while rem_bw or rem_col:
    i = len(out)
    fr = forced.get(i)
    if fr is not None and (fr in rem_bw or fr in rem_col):
        out.append(fr); (rem_bw if fr['bw'] else rem_col).remove(fr); left[fr['s']] -= 1; continue
    recent = {x['s'] for x in out[-VENTANA_SESION:]}
    due = bw_slots and i >= bw_slots[n_bw - len(rem_bw)] if rem_bw else False
    # el blanco y negro entra cuando le toca, salvo que su sesión acabe de salir (entonces espera un poco)
    use_bw = rem_bw and (not rem_col or (due and any(r['s'] not in recent for r in rem_bw)))
    pool = rem_bw if use_bw else rem_col
    reserved = {id(r) for r in forced.values()}
    cand = [r for r in pool if id(r) not in reserved][:40] or pool[:40]
    best = max(cand, key=lambda r: r['score'] - penalty(r, out, left))
    out.append(best); pool.remove(best); left[best['s']] -= 1

d.setdefault('orden', {})['E'] = [r['p'] for r in out]
json.dump(d, open(OUT, 'w'), ensure_ascii=False)

# resumen
same = sum(1 for a, b in zip(out, out[1:]) if a['s'] == b['s'])
near = sum(1 for k in range(len(out)) if any(x['s'] == out[k]['s'] for x in out[max(0, k - VENTANA_SESION):k]))
top_rep = sum(1 for r in out[:TOP_PORTADA] if posH.get(r['p'], 1e9) < TOP_PORTADA)
pairs = sum(1 for a, b in zip(out, out[1:]) if a['p'] in posH and b['p'] in posH and abs(posH[a['p']] - posH[b['p']]) <= VECINAS)
print(f'{N} fotos · B/N {n_bw} en posiciones {[k + 1 for k, r in enumerate(out) if r["bw"]]}')
for a, b in ((0, 30), (30, 100), (100, 200), (200, N)):
    blk = out[a:b]; yy = [r['y'] for r in blk]
    print(f'  {a + 1}-{min(b, N)}: 2021-23 {sum(y in MEJORES for y in yy)}/{len(blk)} · futbolistas {sum(1 for r in blk if FUTBOL.search(r["p"]) and FUTBOLISTAS.search(r["title"]))} · spot {sum(1 for r in blk if r["p"] in spot_up)} · retratos {sum(r["close"] for r in blk)}')
print(f'misma sesión seguidas: {same} · repetida en las últimas {VENTANA_SESION}: {near}')
print(f'de las {TOP_PORTADA} primeras de la portada, en las {TOP_PORTADA} primeras de Editorial: {top_rep} · parejas vecinas de portada: {pairs}')
q = N // 4
for a in range(0, N, q):
    blk = out[a:a + q]
    if blk: print(f'  bloque {a // q + 1}: nitidez media {sum(r["zsharp"] for r in blk) / len(blk):+.2f} · luz media {sum(r["lum"] for r in blk) / len(blk):.2f}')
