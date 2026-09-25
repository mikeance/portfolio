// ALL PICTURES: todas las fotos de la web (y las nuevas de FOTO) para ponerles secciones, nombre y proyecto.
import { S, CAT, ORDEN_CATS, alCambiar, tieneCat, workDe, tituloDe, enWeb, estabaEnWeb, esNueva, pendiente, enWork, src, colorWork, nombreWork, sesion, esc } from './main.js';
import { inspector } from './inspector.js';

const leer = (k, d) => { try { return JSON.parse(localStorage.getItem('estudio-' + k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem('estudio-' + k, JSON.stringify(v)); } catch {} };

export function vistaTodas(root, arg) {
  const f = leer('filtros', { tab: 'web', q: '', cats: [], work: '', sinTitulo: false, alto: 170 });
  if (arg === 'nuevas') f.tab = 'nuevas';
  let sel = new Set(), ancla = null, visibles = [];
  root.innerHTML = `<div class="todas"><section class="lista" id="lista"><div class="barra" id="barra"></div><div id="grupos"></div></section><aside class="panel" id="panel"></aside></div>`;
  const $ = (s) => root.querySelector(s), lista = $('#lista'), grupos = $('#grupos'), panel = $('#panel');

  const deTab = (p) => (f.tab === 'nuevas' ? esNueva(p) : f.tab === 'cambios' ? (enWeb(p) || estabaEnWeb(p)) && (pendiente(p) || (estabaEnWeb(p) && !enWeb(p))) : (enWeb(p) || estabaEnWeb(p)) && !esNueva(p));
  function filtradas() {
    const q = f.q.trim().toLowerCase();
    return [...S.fotos.keys()].filter((p) => deTab(p)
      && (!f.cats.length || f.cats.some((k) => (k === 'W' ? !!workDe(p) : k === '0' ? !ORDEN_CATS.some((c) => tieneCat(p, c)) : tieneCat(p, k))))
      && (!f.work || (f.work === '-' ? !workDe(p) : enWork(p, f.work)))
      && (!f.sinTitulo || !tituloDe(p))
      && (!q || `${tituloDe(p)} ${sesion(p)} ${nombreWork(workDe(p))} ${p}`.toLowerCase().includes(q)));
  }

  function barra() {
    const n = (t) => [...S.fotos.keys()].filter((p) => (t === 'nuevas' ? esNueva(p) : t === 'cambios' ? (enWeb(p) || estabaEnWeb(p)) && (pendiente(p) || (estabaEnWeb(p) && !enWeb(p))) : (enWeb(p) || estabaEnWeb(p)) && !esNueva(p))).length;
    const chip = (k, t, c) => `<button class="chip ${f.cats.includes(k) ? 'on' : ''}" data-c="${k}" style="--c:${c}"><span class="dot"></span>${t}</button>`;
    let ow = `<option value="">Todos los proyectos</option><option value="-" ${f.work === '-' ? 'selected' : ''}>Sin proyecto</option>`;
    for (const w of S.works) { ow += `<option value="${w.slug}" ${f.work === w.slug ? 'selected' : ''}>${esc(w.name)}</option>`; for (const c of w.children) ow += `<option value="${c.slug}" ${f.work === c.slug ? 'selected' : ''}> › ${esc(c.name)}</option>`; }
    $('#barra').innerHTML = `<div class="f1"><div class="seg" id="tabs"><button data-t="web" class="${f.tab === 'web' ? 'on' : ''}">En la web · ${n('web')}</button><button data-t="nuevas" class="${f.tab === 'nuevas' ? 'on' : ''}">Nuevas · ${n('nuevas')}</button><button data-t="cambios" class="${f.tab === 'cambios' ? 'on' : ''}">Sin publicar · ${n('cambios')}</button></div>
        <input class="buscar" id="q" type="search" placeholder="Buscar por nombre, sesión, proyecto o archivo…" value="${esc(f.q)}">
        <span class="zoom" title="Tamaño"><button id="aMenos">−</button><input type="range" id="alto" min="90" max="360" value="${f.alto}"><button id="aMas">+</button></span></div>
      <div class="f2">${ORDEN_CATS.map((k) => chip(k, CAT[k].nom, CAT[k].c)).join('')}${chip('W', 'Works', 'var(--W)')}${chip('0', 'Sin sección', 'var(--mut)')}<span class="sep"></span>
        <select id="work">${ow}</select><button class="chip ${f.sinTitulo ? 'on' : ''}" id="sinT" style="--c:var(--fg)">Sin nombre</button>
        <span class="cuenta" id="cuenta"></span></div>`;
    $('#tabs').onclick = (e) => { const t = e.target.dataset.t; if (t) { f.tab = t; guardarF(); todo(); } };
    const q = $('#q'); q.oninput = () => { f.q = q.value; guardarF(); rejilla(); };
    $('#alto').oninput = (e) => { f.alto = +e.target.value; guardarF(); lista.style.setProperty('--h', f.alto + 'px'); };
    $('#aMenos').onclick = () => { f.alto = Math.max(90, f.alto - 30); guardarF(); barra(); lista.style.setProperty('--h', f.alto + 'px'); };
    $('#aMas').onclick = () => { f.alto = Math.min(360, f.alto + 30); guardarF(); barra(); lista.style.setProperty('--h', f.alto + 'px'); };
    $('#barra').querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { const k = b.dataset.c; f.cats = f.cats.includes(k) ? f.cats.filter((x) => x !== k) : [...f.cats, k]; guardarF(); barra(); rejilla(); }));
    $('#work').onchange = (e) => { f.work = e.target.value; guardarF(); rejilla(); };
    $('#sinT').onclick = () => { f.sinTitulo = !f.sinTitulo; guardarF(); barra(); rejilla(); };
  }
  const guardarF = () => escribir('filtros', f);

  // tarjeta: se reutilizan los nodos para que no parpadeen las fotos
  const nodos = new Map();
  function tarjeta(p) {
    let c = nodos.get(p);
    if (!c) { c = document.createElement('div'); c.className = 'card'; c.dataset.p = p; c.innerHTML = `<img loading="lazy" decoding="async" alt="" src="${src(p, 400)}"><div class="dots"></div><div class="cap"></div>`; nodos.set(p, c); }
    const w = workDe(p), fuera = estabaEnWeb(p) && !enWeb(p), nueva = esNueva(p);
    c.style.setProperty('--r', S.fotos.get(p).r || 0.67);
    c.className = `card ${sel.has(p) ? 'sel' : ''} ${fuera ? 'fuera' : ''} ${nueva ? 'nueva' : ''} ${!nueva && !fuera && pendiente(p) ? 'pend' : ''}`;
    c.querySelector('.dots').innerHTML = ORDEN_CATS.filter((k) => tieneCat(p, k)).map((k) => `<span class="dot" style="--c:${CAT[k].c}" title="${CAT[k].nom}"></span>`).join('');
    let wk = c.querySelector('.wk');
    const etiqueta = nueva ? 'Nueva' : w ? nombreWork(w) : '';
    if (etiqueta) { if (!wk) { wk = document.createElement('span'); wk.className = 'wk'; c.appendChild(wk); } wk.textContent = etiqueta; wk.style.setProperty('--c', nueva ? 'var(--X)' : colorWork(w)); } else wk?.remove();
    c.querySelector('.cap').textContent = fuera ? 'Saldrá de la web' : tituloDe(p) || 'Sin nombre';
    return c;
  }

  function rejilla(mantener = false) {   // mantener: tras un cambio en una foto la lista no se mueve; al filtrar, vuelve arriba
    const y = mantener ? lista.scrollTop : 0; grupos.style.minHeight = grupos.offsetHeight + 'px';
    pintarRejilla();
    grupos.style.minHeight = ''; lista.scrollTop = y;
  }
  function pintarRejilla() {
    const ps = filtradas();
    const g = new Map(); for (const p of ps) { const s = sesion(p); if (!g.has(s)) g.set(s, []); g.get(s).push(p); }
    const orden = [...g.keys()].sort((a, b) => { const na = /^\d/.test(a), nb = /^\d/.test(b); return na !== nb ? nb - na : b.localeCompare(a, 'es', { numeric: true }); });
    visibles = orden.flatMap((s) => g.get(s));
    $('#cuenta').textContent = `${ps.length} ${ps.length === 1 ? 'foto' : 'fotos'}${sel.size ? ` · ${sel.size} seleccionadas` : ''}`;
    grupos.replaceChildren();
    if (!ps.length) { grupos.innerHTML = `<div class="vacio">${f.tab === 'nuevas' ? 'No hay fotos nuevas. Cuando añadas fotos a la carpeta FOTO, aparecerán aquí.' : f.tab === 'cambios' ? 'No hay cambios sin publicar.' : 'Ninguna foto con estos filtros.'}</div>`; return; }
    for (const s of orden) {
      const d = document.createElement('div'); d.className = 'grupo';
      d.innerHTML = `<h3>${esc(s)} <span>${g.get(s).length}</span><button data-g="${esc(s)}">Seleccionar</button></h3>`;
      const jg = document.createElement('div'); jg.className = 'jg';
      for (const p of g.get(s)) jg.appendChild(tarjeta(p));
      d.appendChild(jg); grupos.appendChild(d);
    }
  }
  function refrescar() { for (const c of grupos.querySelectorAll('.card')) tarjeta(c.dataset.p); $('#cuenta').textContent = `${visibles.length} fotos${sel.size ? ` · ${sel.size} seleccionadas` : ''}`; }

  grupos.addEventListener('click', (e) => {
    const gb = e.target.closest('[data-g]');
    if (gb) { const ps = visibles.filter((p) => sesion(p) === gb.dataset.g); const todas = ps.every((p) => sel.has(p)); ps.forEach((p) => (todas ? sel.delete(p) : sel.add(p))); refrescar(); lateral(); return; }
    const c = e.target.closest('.card'); if (!c) return; const p = c.dataset.p;
    if (e.shiftKey && ancla && visibles.includes(ancla)) { const [a, b] = [visibles.indexOf(ancla), visibles.indexOf(p)].sort((x, y) => x - y); visibles.slice(a, b + 1).forEach((x) => sel.add(x)); }
    else if (e.metaKey || e.ctrlKey) { sel.has(p) ? sel.delete(p) : sel.add(p); ancla = p; }
    else { sel = sel.size === 1 && sel.has(p) ? new Set() : new Set([p]); ancla = p; }
    refrescar(); lateral();
  });

  function lateral() { const y = panel.scrollTop, clave = [...sel].join('|'), mismo = panel.dataset.v === clave; panel.dataset.v = clave; pintarLateral(); if (mismo) panel.scrollTop = y; }
  function pintarLateral() {
    const ps = [...sel].filter((p) => S.fotos.has(p));
    if (ps.length) return inspector(panel, ps, { alQuitar: () => { sel = new Set(); } });
    const todas = [...S.fotos.keys()], web = todas.filter(enWeb);
    const sinN = web.filter((p) => !tituloDe(p)).length, sinW = web.filter((p) => !workDe(p)).length, nuevas = todas.filter(esNueva).length;
    panel.innerHTML = `<div class="ins"><div><h4>All pictures</h4><p style="margin:0;color:#555;line-height:1.6">${web.length} fotos en la web${nuevas ? ` · <a href="#/todas/nuevas" style="color:var(--X)">${nuevas} nuevas por revisar</a>` : ''}.</p></div>
      <div class="info"><span>Sin nombre</span><span>${sinN}</span><span>Sin proyecto</span><span>${sinW}</span>${ORDEN_CATS.map((k) => `<span>${CAT[k].nom}</span><span>${web.filter((p) => tieneCat(p, k)).length}</span>`).join('')}</div>
      <p class="ayuda" style="padding:0">Clic en una foto para ver y cambiar su nombre, sus secciones y su proyecto. ⌘ + clic o ⇧ + clic para elegir varias y cambiarlas a la vez; «Seleccionar» en una sesión las elige todas. Los puntos de color son las secciones; la etiqueta, el proyecto.<br><br>Las fotos que añadas a la carpeta FOTO aparecen en «Nuevas». Todo se guarda solo; «Publicar» lo sube a mikeance.com.</p></div>`;
  }

  const tecla = (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || !document.getElementById('modal').hidden) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); sel = new Set(visibles); refrescar(); lateral(); }
    if (e.key === 'Escape' && sel.size) { sel = new Set(); refrescar(); lateral(); }
  };
  addEventListener('keydown', tecla);
  lista.style.setProperty('--h', f.alto + 'px');

  function todo() { barra(); rejilla(); lateral(); }
  todo();
  const off = alCambiar(() => { barra(); rejilla(true); lateral(); });
  return () => { off(); removeEventListener('keydown', tecla); };
}
