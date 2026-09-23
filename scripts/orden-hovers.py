# Orden de TODOS los hovers de works y colecciones (menos los que se pasan en KEEP): nitidez + impacto con azar,
# sin sesiones seguidas, sin colecciones seguidas, alternando retrato / plano abierto.
import json, os, re, math, random, subprocess, hashlib, sys
ROOT='/Users/miguel/Desktop/WEB'; FOTO='/Users/miguel/Desktop/FOTO'
S=sys.argv[1]; EXP=sys.argv[2]; OUT=sys.argv[3]; KEEP=set(sys.argv[4].split(',')) if len(sys.argv)>4 and sys.argv[4] else set()
random.seed(11)
d=json.load(open(EXP)); orden=d.setdefault('orden',{})
photos=json.load(open(f'{ROOT}/src/data/photos.json')); origen=json.load(open(f'{ROOT}/fotos/origen.json'))
cache=json.load(open(f'{ROOT}/catalogo/cache.json')); faces=json.load(open(f'{ROOT}/src/data/faces.json'))
origBySha={p['sha']: origen[p['src']] for p in photos if p['cat'] not in ('work','home') and p.get('src') in origen}
# fotos que solo existen como archivos sueltos en works (Sebago): se buscan en FOTO por huella
def sha12(path):
    h=hashlib.sha1()
    with open(path,'rb') as fh:
        for chunk in iter(lambda: fh.read(1<<20), b''): h.update(chunk)
    return h.hexdigest()[:12]
for sub in ('2020/2020-07 Sebago x Mini','2021/2021-12 Sebago x Mini'):
    dp=os.path.join(FOTO,sub)
    if os.path.isdir(dp):
        for fn in os.listdir(dp):
            if not fn.startswith('.'): origBySha.setdefault(sha12(os.path.join(dp,fn)), f'{sub}/{fn}')
works=[p for p in photos if p['cat']=='work']
# caras (Vision) para las que faltan
BIN=f'{ROOT}/.cache/faces'
todo=sorted({p['id'] for p in works if p['id'] not in faces})
for i in range(0,len(todo),40):
    files=[f'{ROOT}/public/photos/{i_}-800.webp' for i_ in todo[i:i+40]]; files=[f for f in files if os.path.exists(f)]
    if not files: continue
    res=json.loads(subprocess.check_output([BIN]+files))
    for f in files:
        r=res.get(f); i_=os.path.basename(f).split('-')[0]
        if r: faces[i_]={'n':r['n'],'max':round(r['max'],4)}
json.dump(faces,open(f'{ROOT}/src/data/faces.json','w'))
print('caras analizadas ahora:', len(todo))
def session(p):
    parts=p.split('/'); return parts[1] if re.match(r'20\d\d$',parts[0]) and len(parts)>2 else '/'.join(parts[:2])
groups={}
for p in works:
    groups.setdefault('W:'+p['work'],{}).setdefault(p['sha'],p)
    if p.get('section'): groups.setdefault('W:'+p['work']+'/'+p['section'],{}).setdefault(p['sha'],p)
def ordenar(entries):
    rows=[]
    for p in entries:
        fp=origBySha.get(p['sha'])
        if not fp: continue
        c=cache.get(fp,{}); fc=faces.get(p['id'],{}).get('max',0)
        rows.append(dict(p=fp, s=session(fp), col=p.get('section',''), sharp=math.log(max(c.get('sharp',1),1)), sat=p.get('sat',0), lum=p.get('lum',0.5), face=fc, close=fc>=0.04))
    if len(rows)<2: return [r['p'] for r in rows]
    def z(k):
        v=[r[k] for r in rows]; m=sum(v)/len(v); sd=(sum((x-m)**2 for x in v)/len(v))**0.5 or 1
        for r in rows: r['z'+k]=(r[k]-m)/sd
    for r in rows: r['facec']=min(r['face'],0.3); r['expo']=-abs(r['lum']-0.5)
    for k in ('sharp','sat','facec','expo'): z(k)
    for r in rows: r['score']=0.45*r['zsharp']+0.25*r['zsat']+0.15*r['zfacec']+0.15*r['zexpo']+random.gauss(0,0.9)
    rem=sorted(rows,key=lambda r:-r['score']); out=[]
    while rem:
        prev=out[-1] if out else None; best=None; bs=-1e9
        for r in rem[:14]:
            if prev and r['s']==prev['s'] and len(rem)>1 and any(x['s']!=prev['s'] for x in rem[:14]): continue
            sc=r['score']-(1.6 if prev and r['col']==prev['col'] else 0)-(1.1 if prev and r['close']==prev['close'] else 0)
            if sc>bs: bs=sc; best=r
        if best is None: best=rem[0]
        out.append(best); rem.remove(best)
    return [r['p'] for r in out], rows, out
resumen=[]
for key in sorted(groups):
    if key in KEEP: resumen.append((key,'se mantiene')); continue
    res=ordenar(list(groups[key].values()))
    if isinstance(res,tuple):
        lst,rows,out=res
        ss=sum(1 for a,b in zip(out,out[1:]) if a['s']==b['s']); alt=sum(1 for a,b in zip(out,out[1:]) if a['close']!=b['close'])
        resumen.append((key, f'{len(lst)} fotos · sesiones {len({r["s"] for r in rows})} · retratos {sum(r["close"] for r in rows)} · misma sesión seguidas {ss} · alternancias {alt}/{len(out)-1}'))
    else: lst=res; resumen.append((key, f'{len(lst)} fotos'))
    if lst: orden[key]=lst
for k,v in resumen: print(f'  {k}: {v}')
json.dump(d,open(OUT,'w'),ensure_ascii=False); print('escrito', OUT)
