// Panel de una foto (o de varias): nombre, secciones de la web, proyecto, información y quitar de la web.
import { S, CAT, ORDEN_CATS, tieneCat, workDe, tituloDe, enWeb, estabaEnWeb, esNueva, pendiente, ponerCat, ponerWork, ponerTitulo, quitarDeLaWeb, src, nombreWork, colorWork, sesion, pelicula, esc, nuevoWork, confirmar, toast } from './main.js';

function opcionesWork(actual) {
  let h = `<option value="">— Sin proyecto —</option>`;
  for (const w of S.works) {
    h += `<option value="${w.slug}" ${actual === w.slug ? 'selected' : ''}>${esc(w.name)}</option>`;
    for (const c of w.children) h += `<option value="${c.slug}" ${actual === c.slug ? 'selected' : ''}> › ${esc(c.name)}</option>`;
  }
  if (actual === '*') h = `<option value="*" selected>Varios proyectos</option>` + h;
  h += `<optgroup label="Crear"><option value="+">+ Nuevo work…</option>${S.works.filter((w) => w.children.length).map((w) => `<option value="+${w.slug}">+ Nueva colección en ${esc(w.name)}…</option>`).join('')}</optgroup>`;
  return h;
}

/** Pinta el inspector en `el` para las fotos `ps`. opts.volver: texto y función para el enlace de vuelta. */
export function inspector(el, ps, opts = {}) {
  ps = ps.filter((p) => S.fotos.has(p));
  if (!ps.length) { el.innerHTML = ''; return; }
  const uno = ps.length === 1, p = ps[0];
  const volver = opts.volver ? `<button class="volver" data-a="volver">← ${esc(opts.volver)}</button>` : '';
  const chips = ORDEN_CATS.map((k) => {
    const n = ps.filter((x) => tieneCat(x, k)).length;
    return `<button class="chip ${n === ps.length ? 'on' : n ? 'mixto' : ''}" style="--c:${CAT[k].c}" data-cat="${k}"><span class="dot"></span>${CAT[k].nom}</button>`;
  }).join('');
  const ws = new Set(ps.map(workDe)), wAct = ws.size === 1 ? [...ws][0] : '*';
  const proyecto = `<div class="proy"><span class="dot" style="--c:${wAct && wAct !== '*' ? colorWork(wAct) : 'var(--line)'}"></span><select data-a="work">${opcionesWork(wAct)}</select></div>`;
  let cuerpo;
  if (uno) {
    const nueva = esNueva(p), fuera = estabaEnWeb(p) && !enWeb(p), pend = pendiente(p);
    const est = nueva ? ['nueva', 'Nueva en FOTO: aún no está en la web. Ponle una sección o un proyecto y publica.']
      : fuera ? ['nueva', 'No está en ninguna sección: saldrá de la web al publicar.']
      : !estabaEnWeb(p) ? ['pend', 'Entrará en la web al publicar.']
      : pend ? ['pend', 'Tiene cambios sin publicar.'] : ['', 'En la web.'];
    const archivo = p.split('/').pop(), peli = pelicula(p);
    cuerpo = `${volver}
      <div class="prev"><img src="${src(p, 800)}" alt=""></div>
      <div><h4>Nombre</h4><input class="titulo" data-a="titulo" value="${esc(tituloDe(p))}" placeholder="p. ej. Paula · Madrid, 2022"></div>
      <div><h4>Secciones de la web</h4><div class="fila">${chips}</div></div>
      <div><h4>Proyecto (Works)</h4>${proyecto}</div>
      <div class="info"><span>Sesión</span><span>${esc(sesion(p))}</span>${peli ? `<span>Película</span><span>${esc(peli)}</span>` : ''}<span>Archivo</span><span><a data-a="finder" title="Mostrar en el Finder">${esc(archivo)}</a></span></div>
      <div class="estadoFoto ${est[0]}">${est[1]}</div>
      <div class="pie">${nueva ? '<button class="btn peligro" data-a="descartar">Descartar (no usar)</button>' : '<button class="btn peligro" data-a="quitar">Quitar de la web</button>'}</div>`;
  } else {
    const titulos = new Set(ps.map(tituloDe));
    cuerpo = `${volver}
      <div><h4>${ps.length} fotos seleccionadas</h4><div class="multi">${ps.slice(0, 7).map((x) => `<img src="${src(x, 400)}" alt="">`).join('')}${ps.length > 7 ? `<div class="mas">+${ps.length - 7}</div>` : ''}</div></div>
      <div><h4>Nombre para todas</h4><input class="titulo" data-a="titulo" value="${titulos.size === 1 ? esc([...titulos][0]) : ''}" placeholder="${titulos.size === 1 ? 'p. ej. Paula · Madrid, 2022' : 'Varios nombres — escribe para cambiarlos todos'}"></div>
      <div><h4>Secciones de la web</h4><div class="fila">${chips}</div></div>
      <div><h4>Proyecto (Works)</h4>${proyecto}</div>
      <div class="pie"><button class="btn peligro" data-a="quitar">Quitar ${ps.length} de la web</button></div>`;
  }
  el.innerHTML = `<div class="ins">${cuerpo}</div>`;

  el.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { const k = b.dataset.cat; ponerCat(ps, k, !ps.every((x) => tieneCat(x, k))); }));
  const t = el.querySelector('[data-a="titulo"]');
  t.addEventListener('change', () => { const v = t.value.trim(); if (!uno && !v) return; ponerTitulo(ps, v); });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') t.blur(); });
  const sw = el.querySelector('[data-a="work"]');
  sw.onchange = async () => {
    let v = sw.value;
    if (v === '*') return;
    if (v.startsWith('+')) { v = await nuevoWork(v.slice(1) || null); if (!v) { inspector(el, ps, opts); return; } }
    const antes = ps.map(workDe).filter((w) => w && w !== v);
    ponerWork(ps, v);
    if (antes.length && v) toast(`Movida a ${nombreWork(v)} (estaba en ${nombreWork(antes[0])})`, true);
  };
  el.querySelector('[data-a="volver"]')?.addEventListener('click', opts.volver ? opts.alVolver : null);
  el.querySelector('[data-a="finder"]')?.addEventListener('click', () => fetch('/api/finder', { method: 'POST', body: JSON.stringify({ p }) }));
  el.querySelector('[data-a="quitar"]')?.addEventListener('click', async () => {
    if (await confirmar(uno ? 'La foto sale de la web (de todas las secciones y de su proyecto). ¿Seguro?' : `Las ${ps.length} fotos salen de la web (de todas las secciones y de su proyecto). ¿Seguro?`)) { quitarDeLaWeb(ps); opts.alQuitar?.(); }
  });
  el.querySelector('[data-a="descartar"]')?.addEventListener('click', () => { quitarDeLaWeb(ps); opts.alQuitar?.(); });
}
