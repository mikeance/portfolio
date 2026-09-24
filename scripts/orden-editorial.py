# Orden de EDITORIAL: mezcla (no por colores) priorizando nitidez, con el blanco y negro repartido a lo largo
# de la página, sin sesiones seguidas y sin repetir la portada (ni su arranque ni sus parejas de fotos vecinas).
# Uso: python3 scripts/orden-editorial.py <export base.json> <salida.json> [semilla]
# Escribe orden['E'] (rutas de FOTO) en la salida; se aplica con aplicar-seleccion.py como cualquier export.
import json, math, random, re, sys

ROOT = '/Users/miguel/Desktop/WEB'
BASE, OUT = sys.argv[1], sys.argv[2]
random.seed(int(sys.argv[3]) if len(sys.argv) > 3 else 5)

d = json.load(open(BASE))
photos = json.load(open(f'{ROOT}/src/data/photos.json'))
origen = json.load(open(f'{ROOT}/fotos/origen.json'))       # ruta web -> ruta FOTO
cache = json.load(open(f'{ROOT}/catalogo/cache.json'))      # ruta FOTO -> nitidez, etc.
web = {origen[p['src']]: p for p in photos if p['cat'] == 'editorial' and p.get('src') in origen}

BW_MAX = 0.03          # croma medio por píxel por debajo del cual la foto es blanco y negro
TOP_PORTADA = 60       # las primeras de la portada no abren también Editorial
VECINAS = 3            # dos fotos a esta distancia o menos en la portada no van juntas aquí
VENTANA_SESION = 5     # no repetir sesión dentro de las últimas N fotos

posH = {p: i for i, p in enumerate(d.get('portada', []))}

def session(p):
    parts = p.split('/')
    return parts[1] if re.match(r'20\d\d$', parts[0]) and len(parts) > 2 else '/'.join(parts[:3])

rows = []
for p in d['seleccion']['E']:
    w = web.get(p)
    if not w or p in d.get('descartadas', []): continue
    c = cache.get(p, {})
    rows.append(dict(p=p, s=session(p), bw=w.get('chroma', 1) < BW_MAX, lum=w.get('lum', 0.5), hue=w.get('hue', 0),
                     sat=w.get('sat', 0), wide=w.get('ratio', 1) > 1.15,
                     sharp=math.log(max(c.get('sharp', 1), 1)), expo=-abs(w.get('lum', 0.5) - 0.5)))

def z(k):
    v = [r[k] for r in rows]; m = sum(v) / len(v); sd = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5 or 1
    for r in rows: r['z' + k] = (r[k] - m) / sd
for k in ('sharp', 'sat', 'expo'): z(k)
for r in rows: r['score'] = 0.65 * r['zsharp'] + 0.15 * r['zsat'] + 0.2 * r['zexpo'] + random.gauss(0, 0.7)

N = len(rows); bw_rows = [r for r in rows if r['bw']]; n_bw = len(bw_rows)
# posiciones objetivo del blanco y negro, repartidas por toda la página (empezando pronto, no en la primera)
bw_slots = [round((k + 0.6) * N / n_bw) for k in range(n_bw)] if n_bw else []

def penalty(r, out, left):
    i = len(out); pen = 0.0
    # urgencia: las sesiones con muchas fotos pendientes se adelantan un poco para no acabar amontonadas al final
    pen -= 14.0 * left[r['s']] / max(1, len(rows) - i)
    recent = out[-VENTANA_SESION:]
    if any(x['s'] == r['s'] for x in recent): pen += 6.0                       # sesión repetida cerca
    if i < TOP_PORTADA and posH.get(r['p'], 1e9) < TOP_PORTADA: pen += 2.5     # no abrir igual que la portada
    if out and r['p'] in posH and out[-1]['p'] in posH and abs(posH[r['p']] - posH[out[-1]['p']]) <= VECINAS: pen += 3.0
    if out:
        prev = out[-1]
        dh = min(abs(r['hue'] - prev['hue']), 360 - abs(r['hue'] - prev['hue']))
        if abs(r['lum'] - prev['lum']) < 0.07 and dh < 25: pen += 1.2          # romper degradados de color/luz
        if r['wide'] and any(x['wide'] for x in out[-2:]): pen += 1.5          # horizontales separadas
    return pen

rem_bw = sorted(bw_rows, key=lambda r: -r['score'])
rem_col = sorted([r for r in rows if not r['bw']], key=lambda r: -r['score'])
out = []
left = {}
for r in rows: left[r['s']] = left.get(r['s'], 0) + 1
while rem_bw or rem_col:
    i = len(out)
    recent = {x['s'] for x in out[-VENTANA_SESION:]}
    due = bw_slots and i >= bw_slots[n_bw - len(rem_bw)] if rem_bw else False
    # el blanco y negro entra cuando le toca, salvo que su sesión acabe de salir (entonces espera un poco)
    use_bw = rem_bw and (not rem_col or (due and any(r['s'] not in recent for r in rem_bw)))
    pool = rem_bw if use_bw else rem_col
    cand = pool[:40]
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
print(f'misma sesión seguidas: {same} · repetida en las últimas {VENTANA_SESION}: {near}')
print(f'de las {TOP_PORTADA} primeras de la portada, en las {TOP_PORTADA} primeras de Editorial: {top_rep} · parejas vecinas de portada: {pairs}')
q = N // 4
for a in range(0, N, q):
    blk = out[a:a + q]
    if blk: print(f'  bloque {a // q + 1}: nitidez media {sum(r["zsharp"] for r in blk) / len(blk):+.2f} · luz media {sum(r["lum"] for r in blk) / len(blk):.2f}')
