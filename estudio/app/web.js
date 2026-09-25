// MIGUEL ANTÓN: la web por secciones (Portada, Editorial, Faces, Life y Works con sus colecciones).
// Cada sección se ve como en mikeance.com (mismo mosaico) y se ordena arrastrando; a la derecha, fotos para añadir.
import { packMosaic, readingOrder } from '/src/lib/mosaic-layout.js';
import { S, CAT, ORDEN_CATS, alCambiar, cambiar, orden, miembros, tieneCat, enWork, workDe, tituloDe, enWeb, esNueva, descartada, pendiente, ponerCat, ponerOrden, src, ratio, colorWork, nombreWork, sesion, esc, toast, nuevoWork } from './main.js';
import { inspector } from './inspector.js';
import { montarHovers } from './hovers.js';

const REAL = { web: { W: 1504, cols: 5 }, movil: { W: 343, cols: 2 } };
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem('estudio-' + k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem('estudio-' + k, JSON.stringify(v)); } catch {} };

export function vistaWeb(root, K) {
  const esHov = K === 'V' || K.startsWith('V:');
  const esW = K.startsWith('W:'), slug = esW ? K.slice(2) : '', esHome = K === 'H';
  if (!esW && !esHov && !CAT[K]) { location.hash = '#/web/H'; return () => {}; }
  if ((esW && !S.workPorSlug.has(slug.split('/')[0])) || (K.startsWith('V:') && !S.workPorSlug.has(K.slice(2)))) { location.hash = '#/web/H'; return () => {}; }
  const color = esHov ? 'var(--W)' : esW ? colorWork(slug) : CAT[K].c;
  const nombre = esHov ? 'Hovers' : esW ? nombreWork(slug) : CAT[K].nom;
  root.innerHTML = `<div class="web"><aside class="sb" id="sb"></aside>
    <section class="centro" id="centro" style="--c:${color}"><div class="cab" id="cab"></div><div class="bloque"><div class="mos" id="mos"></div></div><div class="bloque" id="resto"></div></section>
    <aside class="panel" id="panel"></aside></div>`;
  const $ = (s) => root.querySelector(s);
  const mos = $('#mos'), panel = $('#panel');
  let elegida = null;                                  // foto abierta en el inspector
  let filtro = { q: '', f: '' }, cuantos = 150;
  let vista = leer('vista', 'web'); const zoom = leer('zoom', { web: 100, movil: 100 });
  let abiertos = new Set(leer('abiertos', [])); if (esW) abiertos.add(slug.split('/')[0]);
  let arrastre = null, dragY = null, raf = 0, ultimo = 0;

  // ---------- barra lateral ----------
  function lateral() {
    const n = (k) => (k === 'H' ? miembros('H').length : miembros(k).length);
    const item = (k, nom, c, extra = '', cls = '') => `<div class="it ${cls} ${k === K ? 'on' : ''}" data-k="${esc(k)}" style="--c:${c}"><span class="dot"></span><span class="nom">${esc(nom)}</span><span class="n">${n(k)}</span>${extra}</div>`;
    let h = `<h3>Web</h3>` + ORDEN_CATS.map((k) => item(k, CAT[k].nom, CAT[k].c)).join('');
    h += `<h3>Works <button data-nuevo="" title="Crear un work nuevo">+ Nuevo</button></h3>`;
    h += `<div class="it ${esHov ? 'on' : ''}" data-k="V" style="--c:var(--W)"><span class="hvico">≋</span><span class="nom">Hovers</span><span class="n">${S.works.length}</span></div>`;
    for (const w of S.works) {
      const hijos = w.children.length, ab = abiertos.has(w.slug);
      h += item('W:' + w.slug, w.name, w.color, hijos ? `<button class="tg ${ab ? 'abierto' : ''}" data-tg="${w.slug}" title="Colecciones">▶</button>` : '');
      if (hijos && ab) {
        h += w.children.map((c) => item('W:' + c.slug, c.name, w.color, '', 'sub')).join('');
        h += `<div class="it sub" data-nuevo="${w.slug}" style="--c:${w.color};color:var(--mut)"><span class="nom">+ Nueva colección</span></div>`;
      }
    }
    $('#sb').innerHTML = h;
  }
  $('#sb').addEventListener('click', async (e) => {
    const tg = e.target.closest('[data-tg]');
    if (tg) { e.stopPropagation(); const s = tg.dataset.tg; abiertos.has(s) ? abiertos.delete(s) : abiertos.add(s); escribir('abiertos', [...abiertos]); return lateral(); }
    const nv = e.target.closest('[data-nuevo]');
    if (nv) { const s = await nuevoWork(nv.dataset.nuevo || null); if (s) location.hash = '#/web/W:' + s; return; }
    const it = e.target.closest('.it[data-k]'); if (it) location.hash = '#/web/' + it.dataset.k;
  });
  // soltar una foto sobre una sección de la barra lateral: se añade a esa sección
  $('#sb').addEventListener('dragover', (e) => { const it = e.target.closest('.it[data-k]'); if (!it || !arrastre) return; e.preventDefault(); $('#sb').querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); it.classList.add('drop'); });
  $('#sb').addEventListener('dragleave', (e) => e.target.closest?.('.it')?.classList.remove('drop'));
  $('#sb').addEventListener('drop', (e) => {
    const it = e.target.closest('.it[data-k]'); $('#sb').querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    if (!it || !arrastre) return; e.preventDefault();
    const k = it.dataset.k, p = arrastre.p; finArrastre();
    if (k.startsWith('W:')) { cambiar((st) => { st.workOf[p] = k.slice(2); st.descartadas = st.descartadas.filter((x) => x !== p); }); toast(`Añadida a ${nombreWork(k.slice(2))}`, true); }
    else if (!tieneCat(p, k)) { ponerCat([p], k, true); toast(`Añadida a ${CAT[k].nom}`, true); }
  });

  if (esHov) {
    lateral();
    const fin = montarHovers($('#centro'), panel, K);
    const offH = alCambiar(lateral);
    return () => { fin(); offH(); };
  }

  // ---------- cabecera ----------
  function cabecera() {
    const lista = orden(K), total = miembros(K).length;
    const enlace = esHome ? 'https://mikeance.com/' : esW ? `https://mikeance.com/works/${slug}/` : `https://mikeance.com/photography/${{ E: 'editorial', P: 'faces', L: 'lifestyle' }[K]}/`;
    const w0 = slug.split('/')[0], conCol = esW && !slug.includes('/') && S.workPorSlug.get(w0)?.children.length;
    const sub = esHome ? `${lista.length} fotos · el orden de la portada` : esW
      ? (conCol ? `${total} fotos · en la web se abre como lista de colecciones: el orden de cada página se edita en su colección` : `${total} fotos · arrastra para ordenar la página del proyecto · ✕ la saca del proyecto`) + ` · <a href="#/web/${slug.includes('/') ? 'V:' + w0 : 'V'}" style="text-decoration:underline;text-decoration-color:var(--mut2)">editar su hover</a>`
      : `${total} fotos · arrastra para ordenar · ✕ la quita de ${nombre}`;
    const [w, c] = slug.split('/');
    const titulo = esW && c ? `<a href="#/web/W:${w}" style="color:var(--mut)">${esc(nombreWork(w))}</a> <small>›</small> ${esc(nombreWork(slug, true))}` : esc(nombre);
    $('#cab').innerHTML = `<div><h1><span class="dot" style="--c:${color}"></span>${titulo}</h1><p>${sub} · <a href="${enlace}" target="_blank" rel="noopener" style="text-decoration:underline;text-decoration-color:var(--mut2)">ver en la web ↗</a></p></div>
      <div class="herr"><div class="seg" id="segVista"><button data-v="web" class="${vista === 'web' ? 'on' : ''}">Navegador</button><button data-v="movil" class="${vista === 'movil' ? 'on' : ''}">Móvil</button></div>
      <span class="zoom" title="Tamaño de las fotos (⌘ + / ⌘ −)"><button id="zMenos">−</button><input type="range" id="zRango" min="10" max="${vista === 'movil' ? 250 : 100}" value="${zoom[vista]}"><button id="zMas">+</button></span></div>`;
    $('#segVista').onclick = (e) => { const v = e.target.dataset.v; if (!v || v === vista) return; vista = v; escribir('vista', vista); cabecera(); colocar(); };
    $('#zRango').oninput = (e) => ponerZoom(+e.target.value);
    $('#zMenos').onclick = () => ponerZoom(zoom[vista] / 1.2); $('#zMas').onclick = () => ponerZoom(zoom[vista] * 1.2);
  }
  function ponerZoom(z) { zoom[vista] = Math.round(Math.min(vista === 'movil' ? 250 : 100, Math.max(10, z))); escribir('zoom', zoom); const r = $('#zRango'); if (r) r.value = zoom[vista]; colocar(); }

  // ---------- mosaico (se reutilizan los nodos para que las fotos no parpadeen) ----------
  const nodos = new Map();
  function mosaico() {
    const lista = orden(K);
    if (!lista.length) { mos.innerHTML = `<div class="vacio">${esW ? 'Este proyecto aún no tiene fotos.<br>Añádelas desde la derecha o arrastrándolas aquí.' : 'Vacío. Añade fotos desde la derecha.'}</div>`; nodos.clear(); mos.style.height = 'auto'; return; }
    mos.querySelector('.vacio')?.remove();
    const vivos = new Set(lista);
    for (const [p, f] of nodos) if (!vivos.has(p)) { f.remove(); nodos.delete(p); }
    const quitar = esHome ? 'Quitar de la portada' : esW ? `Sacar de ${nombre}` : `Quitar de ${nombre}`;
    lista.forEach((p, i) => {
      let f = nodos.get(p);
      if (!f) {
        f = document.createElement('figure'); f.draggable = true; f.dataset.p = p;
        f.innerHTML = `<img alt="" decoding="async"><span class="n" title="Clic para mover a otra posición"></span><button class="x" title="${quitar}">✕</button>`;
        nodos.set(p, f);
      }
      f.classList.toggle('sel', p === elegida); f.classList.toggle('pend', pendiente(p));
      f.title = tituloDe(p) || sesion(p);
      mos.appendChild(f);          // también reordena
    });
    colocar();
  }
  // Los números siguen el orden en que se ven las fotos (de izquierda a derecha y hacia abajo), el mismo que el visor de la web
  let lectura = [];
  function colocar() {
    const figs = [...mos.querySelectorAll('figure')]; if (!figs.length) return;
    const real = REAL[vista], disp = $('#centro').clientWidth - 56;
    const Wv = vista === 'web' ? disp * zoom.web / 100 : Math.min(disp, real.W * zoom.movil / 100), k = Wv / real.W;
    const ratios = figs.map((f) => ratio(f.dataset.p));
    const { pos, height } = packMosaic(ratios, real.W, real.cols, { gap: 10, pad: 12 });
    const ord = readingOrder(pos, ratios, { pad: 12 });
    lectura = ord.map((i) => figs[i].dataset.p);
    ord.forEach((i, n) => { figs[i].querySelector('.n').textContent = n + 1; });
    mos.style.width = Wv + 'px'; mos.style.height = Math.ceil(height * k) + 'px'; mos.style.setProperty('--pad', Math.max(1, 6 * k) + 'px');
    const tile = (Wv - (real.cols - 1) * 10 * k) / real.cols;
    mos.classList.toggle('pequeno', tile < 120); mos.classList.toggle('diminuto', tile < 60);
    figs.forEach((f, i) => {
      const p = pos[i]; f.style.cssText = `left:${p.x * k}px;top:${p.y * k}px;width:${p.w * k}px`;
      const img = f.firstChild, need = p.w * k * (devicePixelRatio || 1) > 420 ? 800 : 400;
      if (!img.dataset.w || +img.dataset.w < need) { img.dataset.w = need; img.src = src(f.dataset.p, need); }
    });
  }

  // ---------- resto (works: fotos del proyecto que no están en el hover) ----------
  function resto() { $('#resto').innerHTML = ''; }

  // ---------- panel derecho: añadir fotos / inspector ----------
  function candidatas() {
    const fuera = (p) => (esHome ? !tieneCat(p, 'H') : esW ? !enWork(p, slug) : !tieneCat(p, K));
    const q = filtro.q.toLowerCase();
    return [...S.fotos.keys()].filter((p) => !descartada(p) && (enWeb(p) || esNueva(p)) && fuera(p)
      && (!filtro.f || (filtro.f === 'N' ? esNueva(p) : filtro.f === 'W' ? !!workDe(p) : tieneCat(p, filtro.f)))
      && (!q || `${tituloDe(p)} ${sesion(p)} ${nombreWork(workDe(p))} ${p}`.toLowerCase().includes(q)))
      .sort((a, b) => esNueva(b) - esNueva(a) || sesion(b).localeCompare(sesion(a)));
  }
  function panelDer() { const y = panel.scrollTop, mismo = panel.dataset.v === (elegida || '+'); panel.dataset.v = elegida || '+'; pintarPanel(); if (mismo) panel.scrollTop = y; }
  function pintarPanel() {
    if (elegida && S.fotos.has(elegida)) {
      return inspector(panel, [elegida], { volver: `Añadir fotos a ${nombre}`, alVolver: () => { elegida = null; mosaico(); panelDer(); }, alQuitar: () => { elegida = null; } });
    }
    const c = candidatas();
    const chip = (f, t, col) => `<button class="chip ${filtro.f === f ? 'on' : ''}" data-f="${f}" style="--c:${col}">${t}</button>`;
    panel.innerHTML = `<div class="pcab"><h2>Añadir a ${esc(esW ? nombreWork(slug, true) : nombre)}</h2>
      <input class="buscar" id="pq" type="search" placeholder="Buscar nombre, sesión, proyecto…" value="${esc(filtro.q)}">
      <div class="chips">${chip('', 'Todas', 'var(--fg)')}${S.datos.nuevas || [...S.fotos.keys()].some(esNueva) ? chip('N', 'Nuevas', 'var(--X)') : ''}${ORDEN_CATS.filter((k) => k !== K).map((k) => chip(k, CAT[k].nom, CAT[k].c)).join('')}${chip('W', 'Works', 'var(--W)')}</div></div>
      <div class="pool" id="pool">${c.slice(0, cuantos).map((p) => `<div class="t ${esNueva(p) ? 'nueva' : ''}" draggable="true" data-p="${esc(p)}" title="${esc((tituloDe(p) || sesion(p)) + (workDe(p) ? ' · ' + nombreWork(workDe(p)) : ''))}"><img loading="lazy" src="${src(p, 400)}" alt=""><div class="dots">${ORDEN_CATS.filter((k) => tieneCat(p, k)).map((k) => `<span class="dot" style="--c:${CAT[k].c}"></span>`).join('')}${workDe(p) ? `<span class="dot" style="--c:${colorWork(workDe(p))}"></span>` : ''}</div></div>`).join('')}
      ${c.length > cuantos ? `<button class="btn mas" id="pmas">Ver ${Math.min(150, c.length - cuantos)} más (${c.length - cuantos})</button>` : ''}${!c.length ? '<p class="vacio" style="grid-column:1/-1;padding:30px 0">No hay fotos con ese filtro.</p>' : ''}</div>
      <p class="ayuda">Clic en una foto para añadirla al final, o arrástrala al punto exacto del mosaico. Clic en una foto del mosaico para ver y editar sus datos.${esW ? ' Si la foto estaba en otro proyecto, se cambia a este.' : ''}</p>`;
    const pq = panel.querySelector('#pq');
    pq.oninput = () => { filtro.q = pq.value; cuantos = 150; const pos = pq.selectionStart; pintarPanel(); const n = panel.querySelector('#pq'); n.focus(); n.setSelectionRange(pos, pos); };
    panel.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filtro.f = b.dataset.f; cuantos = 150; panelDer(); }));
    panel.querySelector('#pmas')?.addEventListener('click', () => { cuantos += 150; panelDer(); });
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('.pool .t'); if (!t) return;
    insertar(t.dataset.p, null);
  });

  /** Mete la foto p en esta sección, antes de `antes` (o al final). Una sola operación (un solo «deshacer»). */
  function insertar(p, antes) {
    const lista = orden(K).filter((x) => x !== p);
    const i = antes ? lista.indexOf(antes) : -1; lista.splice(i < 0 ? lista.length : i, 0, p);
    const otro = esW && workDe(p) && !enWork(p, slug) ? workDe(p) : '';
    cambiar((e) => {
      e.descartadas = e.descartadas.filter((x) => x !== p);
      if (esHome) { e.portada = lista; return; }
      if (esW) {
        e.workOf[p] = slug;
        for (const k of Object.keys(e.orden)) { const s = k.slice(2); if ((k.startsWith('W:') || k.startsWith('V:')) && slug !== s && !slug.startsWith(s + '/')) e.orden[k] = e.orden[k].filter((x) => x !== p); }
        e.orden[K] = lista; return;
      }
      if (!(e.seleccion[K] ||= []).includes(p)) e.seleccion[K].push(p);
      e.orden[K] = lista;
    });
    toast(otro ? `Movida a ${nombreWork(slug)} (estaba en ${nombreWork(otro)})` : `Añadida a ${esW ? nombreWork(slug) : nombre}`, true);
  }

  // ---------- arrastrar (mosaico y panel) ----------
  const finArrastre = () => { arrastre = null; dragY = null; root.querySelectorAll('.drag,.over').forEach((x) => x.classList.remove('drag', 'over')); };
  const centro = $('#centro');
  const auto = () => {
    if (!arrastre || performance.now() - ultimo > 250) { raf = 0; return; }
    if (dragY !== null) { const r = centro.getBoundingClientRect(), b = 90; if (dragY < r.top + b) centro.scrollTop -= Math.ceil(26 * (1 - Math.max(0, dragY - r.top) / b) + 3); else if (dragY > r.bottom - b) centro.scrollTop += Math.ceil(26 * (1 - (r.bottom - dragY) / b) + 3); }
    raf = requestAnimationFrame(auto);
  };
  root.addEventListener('dragstart', (e) => {
    const f = e.target.closest('figure, .t'); if (!f) return;
    arrastre = { p: f.dataset.p, deMosaico: f.tagName === 'FIGURE' }; ultimo = performance.now();
    f.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.dataset.p);
    if (!raf) raf = requestAnimationFrame(auto);
  });
  document.addEventListener('dragover', onDragOverDoc);
  function onDragOverDoc(e) { if (arrastre) { dragY = e.clientY; ultimo = performance.now(); } }
  document.addEventListener('dragend', finArrastre, true);
  mos.addEventListener('dragover', (e) => {
    if (!arrastre) return; e.preventDefault();
    const f = e.target.closest('figure'); mos.querySelectorAll('.over').forEach((x) => x.classList.remove('over'));
    if (f && f.dataset.p !== arrastre.p) f.classList.add('over');
  });
  mos.addEventListener('drop', (e) => {
    if (!arrastre) return; e.preventDefault();
    const f = e.target.closest('figure'), a = arrastre; finArrastre();
    const destino = f?.dataset.p || null;
    if (a.deMosaico) {
      if (!destino || destino === a.p) return;
      const l = orden(K).filter((x) => x !== a.p), despues = lectura.indexOf(a.p) < lectura.indexOf(destino);
      l.splice(l.indexOf(destino) + (despues ? 1 : 0), 0, a.p);
      ponerOrden(K, l);
    } else insertar(a.p, destino);
  });
  mos.addEventListener('click', async (e) => {
    const f = e.target.closest('figure'); if (!f) return; const p = f.dataset.p;
    if (e.target.classList.contains('x')) {
      if (esHome) ponerCat([p], 'H', false);
      else if (esW) {
        const de = workDe(p);
        cambiar((st) => { st.workOf[p] = ''; for (const k of Object.keys(st.orden)) if (k.startsWith('W:') || k.startsWith('V:')) st.orden[k] = st.orden[k].filter((x) => x !== p); });
        toast(enWeb(p) ? `Sacada de ${nombreWork(de)}` : `Sacada de ${nombreWork(de)}: ya no está en ninguna sección, al publicar saldrá de la web`, true);
      }
      else ponerCat([p], K, false);
      if (elegida === p) elegida = null;
      return;
    }
    if (e.target.classList.contains('n')) {
      const from = lectura.indexOf(p);
      const v = await (await import('./main.js')).pedir(`Mover a la posición (1–${lectura.length})`, '', String(from + 1)); if (!v) return;
      const to = Math.min(lectura.length, Math.max(1, parseInt(v, 10) || from + 1)) - 1; if (to === from) return;
      // se coloca junto a la foto que ahora ocupa esa posición (antes si sube, después si baja)
      const destino = lectura[to], l = orden(K).filter((x) => x !== p);
      l.splice(l.indexOf(destino) + (to > from ? 1 : 0), 0, p); ponerOrden(K, l);
      requestAnimationFrame(() => { const g = nodos.get(p); if (g) { g.scrollIntoView({ block: 'center', behavior: 'smooth' }); g.classList.add('over'); setTimeout(() => g.classList.remove('over'), 1400); } });
      return;
    }
    elegida = elegida === p ? null : p; mosaico(); panelDer();
  });

  // ---------- zoom con teclado / pellizco ----------
  const tecla = (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); ponerZoom(zoom[vista] * 1.15); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); ponerZoom(zoom[vista] / 1.15); }
    else if (e.key === '0') { e.preventDefault(); ponerZoom(100); }
  };
  const rueda = (e) => { if (e.ctrlKey) { e.preventDefault(); ponerZoom(zoom[vista] * Math.exp(-e.deltaY / 200)); } };
  addEventListener('keydown', tecla); addEventListener('wheel', rueda, { passive: false });
  const ro = new ResizeObserver(() => colocar()); ro.observe(centro);

  function todo() { lateral(); cabecera(); mosaico(); resto(); panelDer(); }
  todo();
  const off = alCambiar(todo);
  return () => { off(); ro.disconnect(); removeEventListener('keydown', tecla); removeEventListener('wheel', rueda); document.removeEventListener('dragover', onDragOverDoc); document.removeEventListener('dragend', finArrastre, true); };
}
