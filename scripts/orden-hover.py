import json, os, re, math, random, subprocess, sys
ROOT='/Users/miguel/Desktop/WEB'; S=sys.argv[1]; EXP=sys.argv[2]; KEY=sys.argv[3]
random.seed(int(sys.argv[4]) if len(sys.argv)>4 else 7)
d=json.load(open(EXP)); L=d['orden'][KEY]; workOf=d.get('workOf',{})
cache=json.load(open(f'{ROOT}/catalogo/cache.json'))
origen=json.load(open(f'{ROOT}/fotos/origen.json'))            # web rel -> FOTO path
photos=json.load(open(f'{ROOT}/src/data/photos.json'))
faces=json.load(open(f'{ROOT}/src/data/faces.json'))
byOrig={}
for p in photos:
    o=origen.get(p.get('src',''))
    if o and o not in byOrig: byOrig[o]=p
# caras (Vision) para las que faltan en la caché, sobre public/photos/<id>-800.webp
todo=[byOrig[p]['id'] for p in L if p in byOrig and byOrig[p]['id'] not in faces]
BIN=f'{ROOT}/.cache/faces'
for i in range(0,len(todo),40):
    files=[f'{ROOT}/public/photos/{i_}-800.webp' for i_ in todo[i:i+40]]
    files=[f for f in files if os.path.exists(f)]
    if not files: continue
    res=json.loads(subprocess.check_output([BIN]+files))
    for f in files:
        r=res.get(f); i_=os.path.basename(f).split('-')[0]
        if r: faces[i_]={'n':r['n'],'max':round(r['max'],4)}
json.dump(faces,open(f'{ROOT}/src/data/faces.json','w'))
def session(p):
    parts=p.split('/'); return parts[1] if re.match(r'20\d\d$',parts[0]) and len(parts)>2 else '/'.join(parts[:2])
rows=[]
for p in L:
    w=byOrig.get(p); c=cache.get(p,{})
    if not w: print('sin datos web:',p); continue
    fc=faces.get(w['id'],{}).get('max',0)
    rows.append(dict(p=p, s=session(p), col=workOf.get(p,''), sharp=math.log(max(c.get('sharp',1),1)), sat=w.get('sat',0), lum=w.get('lum',0.5), face=fc, close=fc>=0.04))
def z(k):
    v=[r[k] for r in rows]; m=sum(v)/len(v); sd=(sum((x-m)**2 for x in v)/len(v))**0.5 or 1
    for r in rows: r['z'+k]=(r[k]-m)/sd
for k in ('sharp','sat'): z(k)
for r in rows: r['facec']=min(r['face'],0.3); r['expo']=-abs(r['lum']-0.5)
z('facec'); z('expo')
for r in rows: r['score']=0.45*r['zsharp']+0.25*r['zsat']+0.15*r['zfacec']+0.15*r['zexpo']+random.gauss(0,0.9)
rem=sorted(rows,key=lambda r:-r['score']); out=[]
while rem:
    prev=out[-1] if out else None
    best=None; bs=-1e9
    for r in rem[:14]:
        if prev and r['s']==prev['s']: continue
        sc=r['score']-(1.6 if prev and r['col']==prev['col'] else 0)-(1.1 if prev and r['close']==prev['close'] else 0)
        if sc>bs: bs=sc; best=r
    if best is None: best=rem[0]
    out.append(best); rem.remove(best)
same_s=sum(1 for a,b in zip(out,out[1:]) if a['s']==b['s']); same_c=sum(1 for a,b in zip(out,out[1:]) if a['col']==b['col']); alt=sum(1 for a,b in zip(out,out[1:]) if a['close']!=b['close'])
print(f'{len(out)} fotos · retratos {sum(r["close"] for r in out)} · sesiones {len(set(r["s"] for r in out))} · colecciones {len(set(r["col"] for r in out))}')
print(f'adyacentes misma sesión: {same_s} · misma colección: {same_c} · alternancia retrato/abierto: {alt}/{len(out)-1}')
print('primeras 8:', [ (r['s'][:22], 'R' if r['close'] else 'A', round(r['score'],1)) for r in out[:8]])
d['orden'][KEY]=[r['p'] for r in out]
json.dump(d,open(f'{S}/export-hover.json','w'),ensure_ascii=False)
print('escrito', f'{S}/export-hover.json')
