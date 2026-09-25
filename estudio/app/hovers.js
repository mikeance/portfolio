// WORKS › HOVERS: las filas de fotos que salen al pasar el ratón por cada work (página /works) o por cada colección
// (p. ej. /works/scrapworld), tal cual se ven en la web. Su orden es independiente del de la página del proyecto.
import { S, alCambiar, cambiar, hover, miembros, orden, workDe, tituloDe, src, ratio, colorWork, nombreWork, sesion, esc, toast } from './main.js';
import { inspector } from './inspector.js';

const leer = (k, d) => { try { return JSON.parse(localStorage.getItem('estudio-' + k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem('estudio-' + k, JSON.stringify(v)); } catch {} };

// letras descolocadas como en la web (misma semilla que src/components/Scatter.astro)
function scatter(text) {
  let t = 0; for (const ch of text) t = (t * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { t = (Math.imul(t ^ (t >>> 15), 0x2c1b3c6d) + 0x1b873593) >>> 0; return (t >>> 8) / 16777216; };
  const chars = [...text];
  return chars.map((ch, i) => {
    if (ch === ' ') return '<span class="sp"> </span>';
    const edge = i === 0 || i === chars.length - 1, still = edge || rnd() < 0.3;
    const rot = still ? 0 : (rnd() * 2 - 1) * 16, dy = still ? 0 : (rnd() * 2 - 1) * 0.12, dx = edge ? 0 : (rnd() * 2 - 1) * 0.03;
    return `<span class="l" style="--m:translate(${dx.toFixed(3)}em,${dy.toFixed(3)}em) rotate(${rot.toFixed(1)}deg)">${esc(ch)}</span>`;
  }).join('');
}

/** Monta la vista de hovers en el centro y el panel derecho. K = 'V' (página /works) o 'V:<work>' (sus colecciones). */
export function montarHovers(centro, panel, K) {
  const padre = K.startsWith('V:') ? K.slice(2) : '';
  const W = padre ? S.workPorSlug.get(padre) : null;
  const items = W ? W.children.map((c) => ({ slug: c.slug, nombre: c.name })) : S.works.map((w) => ({ slug: w.slug, nombre: w.name }));
  let modo = leer('hov-modo', 'editar'), alto = leer('hov-alto', 231);
  let activa = leer('hov-activa-' + (padre || 'works'), items[0]?.slug) ; if (!items.some((i) => i.slug === activa)) activa = items[0]?.slug;
  let elegida = null;

  centro.innerHTML = `<div class="cab" id="hcab"></div><div class="bloque"><ul class="hovers" id="hlista"></ul></div>`;
  const lista = centro.querySelector('#hlista');

  function cabecera() {
    const conCol = S.works.filter((w) => w.children.length);
    centro.querySelector('#hcab').innerHTML = `<div><h1><span class="dot" style="--c:var(--W)"></span>Hovers${W ? ` <small>›</small> ${esc(W.name)}` : ''}</h1>
      <p>${W ? `Las filas de cada colección en la página de ${esc(W.name)}` : 'Las filas de fotos al pasar el ratón por cada proyecto en WORKS'} · su orden no cambia el de la página del proyecto · <a href="https://mikeance.com/works/${W ? W.slug + '/' : ''}" target="_blank" rel="noopener" style="text-decoration:underline;text-decoration-color:var(--mut2)">ver en la web ↗</a></p></div>
      <div class="herr"><div class="seg" id="hPag"><button data-k="V" class="${!W ? 'on' : ''}">Works</button>${conCol.map((w) => `<button data-k="V:${w.slug}" class="${W?.slug === w.slug ? 'on' : ''}">${esc(w.name)}</button>`).join('')}</div>
      <div class="seg" id="hModo"><button data-m="editar" class="${modo === 'editar' ? 'on' : ''}">Editar</button><button data-m="web" class="${modo === 'web' ? 'on' : ''}">Como en la web</button></div>
      <span class="zoom" title="Alto de las fotos (en la web, 231 px)"><button id="hMenos">−</button><input type="range" id="hAlto" min="70" max="231" value="${alto}"><button id="hMas">+</button></span></div>`;
    centro.querySelector('#hPag').onclick = (e) => { const k = e.target.dataset.k; if (k) location.hash = '#/web/' + k; };
    centro.querySelector('#hModo').onclick = (e) => { const m = e.target.dataset.m; if (m && m !== modo) { modo = m; escribir('hov-modo', modo); cabecera(); pintar(); } };
    const setAlto = (v) => { alto = Math.round(Math.min(231, Math.max(70, v))); escribir('hov-alto', alto); lista.style.setProperty('--hh', alto + 'px'); const r = centro.querySelector('#hAlto'); if (r) r.value = alto; };
    centro.querySelector('#hAlto').oninput = (e) => setAlto(+e.target.value);
    centro.querySelector('#hMenos').onclick = () => setAlto(alto - 30); centro.querySelector('#hMas').onclick = () => setAlto(alto + 30);
    lista.style.setProperty('--hh', alto + 'px');
  }

  // filas (se reutilizan las imágenes para que no parpadeen)
  const imgs = new Map();
  const imagen = (p) => { let im = imgs.get(p); if (!im) { im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = ''; im.src = src(p, 400); im.srcset = `${src(p, 400)} 1x, ${src(p, 800)} 2x`; im.style.aspectRatio = ratio(p); imgs.set(p, im); } return im; };
  function pintar() {
    lista.className = `hovers ${modo === 'web' ? 'comoweb' : 'editar'}`;
    const scroll = new Map([...lista.querySelectorAll('li')].map((li) => [li.dataset.s, li.querySelector('.strip')?.scrollLeft || 0]));
    lista.replaceChildren();
    for (const it of items) {
      const fila = hover(it.slug), total = miembros('W:' + it.slug).length, propio = (S.estado.orden['V:' + it.slug] || []).length > 0;
      const li = document.createElement('li'); li.dataset.s = it.slug; li.className = it.slug === activa && modo === 'editar' ? 'activa' : '';
      li.style.setProperty('--c', colorWork(it.slug));
      li.innerHTML = `<div class="hvcab"><a class="work" href="#">${scatter(it.nombre)}</a>${modo === 'editar' ? `<span class="hvn">${fila.length === total ? `todas (${total})` : `${fila.length} de ${total}`}${propio && fila.length !== total ? ' · <button data-a="todas">Poner todas</button>' : ''}</span>` : ''}</div><div class="strip"></div>`;
      const st = li.querySelector('.strip');
      fila.forEach((p, i) => {
        const a = document.createElement('a'); a.className = 'ph'; a.dataset.p = p; a.draggable = modo === 'editar';
        a.title = tituloDe(p) || sesion(p);
        a.appendChild(imagen(p));
        if (modo === 'editar') a.insertAdjacentHTML('beforeend', `<span class="n">${i + 1}</span><button class="x" title="Quitar del hover (sigue en el proyecto)">✕</button>`);
        else if (tituloDe(p)) a.insertAdjacentHTML('beforeend', `<span class="cap">${esc(tituloDe(p))}</span>`);
        a.classList.toggle('sel', p === elegida);
        st.appendChild(a);
      });
      if (modo === 'editar' && fila.length < total) st.insertAdjacentHTML('beforeend', `<button class="mas" data-a="mas" title="Añadir fotos del proyecto">+<small>${total - fila.length}</small></button>`);
      lista.appendChild(li);
      st.scrollLeft = scroll.get(it.slug) || 0;
    }
  }

  // panel derecho: fotos del proyecto que no están en su hover (o la foto elegida)
  function lateral() {
    if (elegida && S.fotos.has(elegida)) return inspector(panel, [elegida], { volver: 'Fotos para el hover', alVolver: () => { elegida = null; pintar(); lateral(); }, alQuitar: () => { elegida = null; } });
    const it = items.find((i) => i.slug === activa);
    if (!it) { panel.innerHTML = '<div class="ins"><p class="ayuda" style="padding:0">Este proyecto no tiene colecciones.</p></div>'; return; }
    const dentro = new Set(hover(it.slug)), fuera = orden('W:' + it.slug).filter((p) => !dentro.has(p));
    panel.innerHTML = `<div class="pcab"><h2>Añadir al hover de ${esc(it.nombre)}</h2><p class="ayuda" style="padding:0;margin:0">${fuera.length ? `${fuera.length} ${fuera.length === 1 ? 'foto del proyecto no está' : 'fotos del proyecto no están'} en el hover. Clic para añadirla al final, o arrástrala a su sitio en la fila.` : 'Todas las fotos del proyecto están en el hover.'}</p></div>
      <div class="pool">${fuera.map((p) => `<div class="t" draggable="true" data-p="${esc(p)}" title="${esc(tituloDe(p) || sesion(p))}" style="--c:${colorWork(it.slug)}"><img loading="lazy" src="${src(p, 400)}" alt=""></div>`).join('')}</div>
      <p class="ayuda">Arrastra las fotos dentro de cada fila para ordenarlas; ✕ la quita del hover (sigue en el proyecto y en su página). Clic en una fila para elegirla y ver aquí sus fotos. «Como en la web» muestra la lista igual que mikeance.com: pasa el ratón por los nombres.</p>`;
  }
  const poner = (slug, l) => cambiar((e) => { e.orden['V:' + slug] = l; });

  lista.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return; const slug = li.dataset.s;
    if (e.target.closest('a.work')) e.preventDefault();
    if (modo === 'web') return;
    if (e.target.closest('[data-a="todas"]')) { cambiar((st) => { delete st.orden['V:' + slug]; }); toast('El hover muestra todas las fotos del proyecto', true); return; }
    const x = e.target.closest('.x');
    if (x) { const p = x.closest('.ph').dataset.p, l = hover(slug).filter((q) => q !== p); if (!l.length) return toast('El hover necesita al menos una foto'); poner(slug, l); toast('Quitada del hover', true); return; }
    if (e.target.closest('[data-a="mas"]')) { activa = slug; escribir('hov-activa-' + (padre || 'works'), activa); elegida = null; pintar(); lateral(); return; }
    const n = e.target.closest('.n');
    if (n) { mover(slug, n.closest('.ph').dataset.p); return; }
    const ph = e.target.closest('.ph');
    if (ph) { elegida = elegida === ph.dataset.p ? null : ph.dataset.p; activa = slug; pintar(); lateral(); return; }
    if (activa !== slug) { activa = slug; escribir('hov-activa-' + (padre || 'works'), activa); elegida = null; pintar(); lateral(); }
  });
  async function mover(slug, p) {
    const l = hover(slug), from = l.indexOf(p);
    const v = await (await import('./main.js')).pedir(`Mover a la posición (1–${l.length})`, '', String(from + 1)); if (!v) return;
    const to = Math.min(l.length, Math.max(1, parseInt(v, 10) || from + 1)) - 1; if (to === from) return;
    l.splice(from, 1); l.splice(to, 0, p); poner(slug, l);
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('.pool .t'); if (!t || !activa) return;
    poner(activa, [...hover(activa), t.dataset.p]); toast('Añadida al hover', true);
  });

  // arrastrar dentro de una fila, o desde el panel a una fila (solo fotos de ese proyecto)
  let drag = null;
  const limpiar = () => { drag = null; centro.querySelectorAll('.antes,.despues,.drag').forEach((x) => x.classList.remove('antes', 'despues', 'drag')); };
  const onDragStart = (e) => {
    const a = e.target.closest('.ph, .pool .t'); if (!a) return;
    const li = a.closest('li'); drag = { p: a.dataset.p, de: li ? li.dataset.s : activa };
    a.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', a.dataset.p);
  };
  centro.addEventListener('dragstart', onDragStart); panel.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragend', limpiar, true);
  lista.addEventListener('dragover', (e) => {
    if (!drag) return; const li = e.target.closest('li'); if (!li || li.dataset.s !== drag.de) return;
    e.preventDefault();
    const st = li.querySelector('.strip'), r = st.getBoundingClientRect();
    if (e.clientX < r.left + 60) st.scrollLeft -= 18; else if (e.clientX > r.right - 60) st.scrollLeft += 18;   // desplaza la fila al acercarse al borde
    centro.querySelectorAll('.antes,.despues').forEach((x) => x.classList.remove('antes', 'despues'));
    const a = e.target.closest('.ph'); if (!a || a.dataset.p === drag.p) return;
    const b = a.getBoundingClientRect(); a.classList.add(e.clientX < b.left + b.width / 2 ? 'antes' : 'despues');
  });
  lista.addEventListener('drop', (e) => {
    if (!drag) return; const li = e.target.closest('li'); if (!li || li.dataset.s !== drag.de) return limpiar();
    e.preventDefault();
    const slug = li.dataset.s, a = e.target.closest('.ph'), p = drag.p;
    const l = hover(slug).filter((q) => q !== p);
    let i = l.length;
    if (a && a.dataset.p !== p) { const b = a.getBoundingClientRect(); i = l.indexOf(a.dataset.p) + (e.clientX < b.left + b.width / 2 ? 0 : 1); }
    limpiar();
    const nueva = !hover(slug).includes(p);
    l.splice(i, 0, p); poner(slug, l);
    if (nueva) toast('Añadida al hover', true);
  });

  cabecera(); pintar(); lateral();
  const off = alCambiar(() => { pintar(); lateral(); });
  return () => { off(); document.removeEventListener('dragend', limpiar, true); };
}
