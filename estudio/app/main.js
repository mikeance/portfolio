// Estudio — núcleo: datos, cambios (con deshacer), guardado automático, rutas y publicación.
import { vistaWeb } from './web.js';
import { vistaTodas } from './todas.js';

const $ = (s, el = document) => el.querySelector(s);
export const CAT = { H: { nom: 'Portada', c: 'var(--H)' }, E: { nom: 'Editorial', c: 'var(--E)' }, P: { nom: 'Faces', c: 'var(--P)' }, L: { nom: 'Life', c: 'var(--L)' } };
export const ORDEN_CATS = ['H', 'E', 'P', 'L'];
const PALETA = ['#7048e8', '#0c8599', '#e8590c', '#c2255c', '#2b8a3e', '#1971c2', '#a61e4d', '#5f3dc4', '#e67700', '#0b7285', '#862e9c', '#364fc7', '#d9480f', '#495057', '#087f5b', '#9c36b5'];

export const S = {
  datos: null, estado: null, publicado: null, fotos: new Map(), works: [], workPorSlug: new Map(),
  historia: [], futuro: [], oyentes: new Set(), base: null,
};

// ---------- utilidades de estado ----------
const clonar = (o) => JSON.parse(JSON.stringify(o));
let idx = null;   // índices derivados (se rehacen tras cada cambio)
function indexar() {
  const e = S.estado, m = new Map();
  for (const [k, v] of Object.entries(e.seleccion || {})) for (const p of v) m.set(p, (m.get(p) || '') + k);
  idx = { marcas: m, portada: new Set(e.portada || []), descartadas: new Set(e.descartadas || []) };
  const mp = new Map(); for (const [k, v] of Object.entries(S.publicado.seleccion || {})) for (const p of v) mp.set(p, (mp.get(p) || '') + k);
  idx.marcasPub = mp; idx.portadaPub = new Set(S.publicado.portada || []);
}
export const marcas = (p) => idx.marcas.get(p) || '';
export const tieneCat = (p, k) => (k === 'H' ? idx.portada.has(p) : marcas(p).includes(k));
export const workDe = (p) => S.estado.workOf?.[p] || '';
export const tituloDe = (p) => S.estado.titulos?.[p] || '';
export const enWeb = (p) => /[PEL]/.test(marcas(p)) || idx.portada.has(p) || !!workDe(p);
export const estabaEnWeb = (p) => idx.marcasPub.has(p);
export const esNueva = (p) => !estabaEnWeb(p) && !enWeb(p) && !idx.descartadas.has(p);
export const descartada = (p) => idx.descartadas.has(p);
export function pendiente(p) {
  const pub = S.publicado;
  return (idx.marcasPub.get(p) || '').replace('W', '') !== marcas(p).replace('W', '') || idx.portadaPub.has(p) !== idx.portada.has(p)
    || (pub.workOf?.[p] || '') !== workDe(p) || (pub.titulos?.[p] || '') !== tituloDe(p);
}

// fotos de un work o colección (un work incluye sus colecciones)
export const enWork = (p, slug) => { const w = workDe(p); return w === slug || w.startsWith(slug + '/'); };
export function miembros(k) {
  if (k === 'H') return (S.estado.portada || []).filter((p) => S.fotos.has(p));
  if (k.startsWith('W:')) { const s = k.slice(2); return [...S.fotos.keys()].filter((p) => enWork(p, s)); }
  return [...S.fotos.keys()].filter((p) => marcas(p).includes(k));
}
/** Orden de una sección tal y como sale en la web: el manual (si lo hay) y detrás el automático. En works, el orden manual
 *  es la fila del hover (puede ser una parte); si no hay, el hover son todas en el orden actual. */
export function orden(k) {
  if (k === 'H') return miembros('H');
  const mem = new Set(miembros(k)), man = (S.estado.orden?.[k] || []).filter((p) => mem.has(p));
  const out = [...new Set(man)];
  if (k.startsWith('W:') && out.length) return out;
  const vistos = new Set(out);
  for (const p of [...(S.datos.ordenAuto[k] || []), ...mem]) if (mem.has(p) && !vistos.has(p)) { vistos.add(p); out.push(p); }
  return out;
}
export const restoWork = (k) => { const h = new Set(orden(k)); return miembros(k).filter((p) => !h.has(p)); };

// ---------- cambios ----------
export function cambiar(fn, msg) {
  S.historia.push(JSON.stringify(S.estado)); if (S.historia.length > 60) S.historia.shift();
  S.futuro = [];
  fn(S.estado);
  normalizar();
  guardarLuego();
  avisar();
  if (msg) toast(msg, true);
}
function normalizar() {
  const e = S.estado;
  e.seleccion ||= {}; e.portada ||= []; e.orden ||= {}; e.workOf ||= {}; e.titulos ||= {}; e.descartadas ||= [];
  for (const k of ['P', 'E', 'L']) e.seleccion[k] = [...new Set(e.seleccion[k] || [])];
  e.portada = [...new Set(e.portada)];
  indexar();
  // «W»: en la web sin categoría (solo en un work o en la portada)
  e.seleccion.W = [...S.fotos.keys()].filter((p) => !/[PEL]/.test(marcas(p)) && (idx.portada.has(p) || workDe(p)));
  for (const [k, v] of Object.entries(e.titulos)) if (!v) delete e.titulos[k];
  indexar();
}
export function deshacer() { if (!S.historia.length) return; S.futuro.push(JSON.stringify(S.estado)); S.estado = JSON.parse(S.historia.pop()); normalizar(); guardarLuego(); avisar(); }
export function rehacer() { if (!S.futuro.length) return; S.historia.push(JSON.stringify(S.estado)); S.estado = JSON.parse(S.futuro.pop()); normalizar(); guardarLuego(); avisar(); }
export const alCambiar = (f) => { S.oyentes.add(f); return () => S.oyentes.delete(f); };
function avisar() { cabecera(); for (const f of S.oyentes) f(); }

// operaciones
export function ponerCat(ps, k, on) {
  cambiar((e) => {
    for (const p of ps) {
      if (k === 'H') { if (on && !e.portada.includes(p)) e.portada.push(p); if (!on) e.portada = e.portada.filter((x) => x !== p); continue; }
      const l = e.seleccion[k] ||= [];
      if (on && !l.includes(p)) { l.push(p); if (e.orden[k]?.length) e.orden[k].push(p); }
      if (!on) { e.seleccion[k] = l.filter((x) => x !== p); if (e.orden[k]) e.orden[k] = e.orden[k].filter((x) => x !== p); }
      e.descartadas = e.descartadas.filter((x) => x !== p);
    }
  });
  const fuera = ps.filter((p) => !enWeb(p) && estabaEnWeb(p));
  if (fuera.length) toast(fuera.length === 1 ? 'Ya no está en ninguna sección: al publicar saldrá de la web' : `${fuera.length} fotos ya no están en ninguna sección: al publicar saldrán de la web`, true);
}
export function ponerWork(ps, slug) {
  cambiar((e) => {
    for (const p of ps) {
      const antes = e.workOf[p] || '';
      e.workOf[p] = slug;
      if (antes && antes !== slug) for (const k of Object.keys(e.orden)) { const s = k.slice(2); if (k.startsWith('W:') && slug !== s && !slug.startsWith(s + '/')) e.orden[k] = e.orden[k].filter((x) => x !== p); }
      if (slug) for (const k of ['W:' + slug, 'W:' + slug.split('/')[0]]) if (e.orden[k]?.length && !e.orden[k].includes(p)) e.orden[k].push(p);
      e.descartadas = e.descartadas.filter((x) => x !== p);
    }
  });
}
export function ponerTitulo(ps, t) { cambiar((e) => { for (const p of ps) { if (t) e.titulos[p] = t; else delete e.titulos[p]; } }); }
export function ponerOrden(k, lista) { cambiar((e) => { if (k === 'H') e.portada = lista.slice(); else e.orden[k] = lista.slice(); }); }
export function quitarDeLaWeb(ps) {
  cambiar((e) => {
    const s = new Set(ps);
    for (const k of Object.keys(e.seleccion)) e.seleccion[k] = e.seleccion[k].filter((p) => !s.has(p));
    e.portada = e.portada.filter((p) => !s.has(p));
    for (const k of Object.keys(e.orden)) e.orden[k] = e.orden[k].filter((p) => !s.has(p));
    for (const p of ps) { e.workOf[p] = ''; if (!e.descartadas.includes(p)) e.descartadas.push(p); }
  }, ps.length === 1 ? 'Quitada de la web' : `${ps.length} fotos quitadas de la web`);
}

// ---------- imágenes ----------
export function src(p, ancho = 400) {
  const f = S.fotos.get(p);
  if (f?.id) return `/public/photos/${f.id}-${ancho <= 400 ? 400 : ancho <= 800 ? 800 : 1600}.webp`;
  return `/foto?p=${encodeURIComponent(p)}&w=${ancho <= 400 ? 400 : ancho <= 800 ? 800 : 1600}`;
}
export const ratio = (p) => S.fotos.get(p)?.r || 0.67;

// ---------- works y colores ----------
export const colorWork = (slug) => S.workPorSlug.get(slug.split('/')[0])?.color || 'var(--W)';
export function nombreWork(slug, corto = false) {
  if (!slug) return '';
  const [w, s] = slug.split('/'); const W = S.workPorSlug.get(w);
  if (!W) return slug;
  if (!s) return W.name;
  const c = W.children.find((x) => x.slug === slug);
  return corto ? (c?.name || s) : `${W.name} › ${c?.name || s}`;
}
function prepararWorks(ws) {
  S.works = ws; S.workPorSlug = new Map();
  ws.forEach((w, i) => { w.color = PALETA[i % PALETA.length]; S.workPorSlug.set(w.slug, w); });
}
export async function nuevoWork(padre) {
  const nombre = await pedir(padre ? `Nueva colección en ${nombreWork(padre)}` : 'Nuevo work', padre ? 'Nombre de la colección (p. ej. SUMMER26)' : 'Nombre del proyecto (p. ej. NIKE x SCRAPWORLD)');
  if (!nombre) return null;
  const r = await (await fetch('/api/work', { method: 'POST', body: JSON.stringify({ nombre, padre }) })).json();
  if (r.error) { toast(r.error); return null; }
  prepararWorks(r.works); avisar();
  toast(`Creado ${nombreWork(r.slug)}. Saldrá en la web cuando tenga fotos.`);
  return r.slug;
}

// sesión (carpeta de FOTO) y película
const limpiar = (s) => s.replace(/\s*\(#\d+\)/, '').replace(/\s*\[de Fotos\]/, '').trim();
export function sesion(p) {
  const parts = p.split('/');
  if (/^20\d\d$/.test(parts[0]) && parts.length > 2) return limpiar(parts[1]);
  return parts.slice(0, Math.min(parts.length - 1, 3)).map(limpiar).join(' › ').replace(/^EQUIPO ANTERIOR › /, '');
}
export function pelicula(p) { const m = p.match(/Roll\s*\d+\s*-\s*([^/]+)/i); return m ? m[1].trim() : ''; }

// ---------- guardado automático ----------
let tGuardar = 0, guardando = false, sinGuardar = false;
function guardarLuego() { sinGuardar = true; cabecera(); clearTimeout(tGuardar); tGuardar = setTimeout(guardar, 500); }
async function guardar() {
  if (guardando) { tGuardar = setTimeout(guardar, 300); return; }
  guardando = true;
  try {
    const hay = hayCambios();
    if (hay) await fetch('/api/estado', { method: 'PUT', body: JSON.stringify({ base: S.base, estado: S.estado }) });
    else await fetch('/api/estado', { method: 'DELETE' });
    sinGuardar = false;
  } catch { toast('No se ha podido guardar: ¿está abierta la app?'); }
  guardando = false; cabecera();
}
addEventListener('beforeunload', (e) => { if (sinGuardar) { guardar(); e.preventDefault(); } });

// ---------- diferencias con lo publicado ----------
const igual = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
export function resumen() {
  const pub = S.publicado, e = S.estado, r = { nuevas: 0, quitadas: 0, secciones: 0, titulos: 0, works: 0, ordenes: [] };
  const todas = new Set([...idx.marcasPub.keys(), ...idx.marcas.keys()]);
  for (const p of todas) {
    const a = (idx.marcasPub.get(p) || '').replace('W', ''), b = marcas(p).replace('W', '');
    const ea = idx.marcasPub.has(p), eb = enWeb(p);
    if (!ea && eb) r.nuevas++; else if (ea && !eb) r.quitadas++;
    else if (ea && (a !== b || idx.portadaPub.has(p) !== idx.portada.has(p))) r.secciones++;
    if (eb && (pub.titulos?.[p] || '') !== tituloDe(p)) r.titulos++;
    if (eb && ea && (pub.workOf?.[p] || '') !== workDe(p)) r.works++;
  }
  // cambio de orden = las fotos que están antes y después cambian de posición relativa (añadir o quitar no cuenta)
  const reordenada = (a = [], b = []) => { const sa = new Set(a), sb = new Set(b); return !igual(a.filter((p) => sb.has(p)), b.filter((p) => sa.has(p))); };
  if (reordenada(pub.portada, e.portada)) r.ordenes.push('Portada');
  for (const k of new Set([...Object.keys(pub.orden || {}), ...Object.keys(e.orden || {})])) {
    const a = (pub.orden || {})[k] || [], b = (e.orden || {})[k] || [];
    if (reordenada(a.length ? a : S.datos.ordenAuto[k], b.length ? b : S.datos.ordenAuto[k]) || (a.length && !b.length && k.startsWith('W:'))) r.ordenes.push(k.startsWith('W:') ? nombreWork(k.slice(2)) : CAT[k]?.nom || k);
  }
  r.ordenes = [...new Set(r.ordenes)];
  r.total = r.nuevas + r.quitadas + r.secciones + r.titulos + r.works + r.ordenes.length;
  return r;
}
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : o && typeof o === 'object' ? `{${Object.keys(o).filter((k) => k !== 'exportado').sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',')}}` : JSON.stringify(o));
export const hayCambios = () => canon(S.estado) !== canon(S.publicadoNorm);
function textoResumen(r) {
  const t = [];
  if (r.nuevas) t.push(`${r.nuevas} ${r.nuevas === 1 ? 'foto nueva' : 'fotos nuevas'}`);
  if (r.quitadas) t.push(`${r.quitadas} ${r.quitadas === 1 ? 'quitada' : 'quitadas'}`);
  if (r.secciones) t.push(`secciones de ${r.secciones}`);
  if (r.titulos) t.push(`${r.titulos} ${r.titulos === 1 ? 'nombre' : 'nombres'}`);
  if (r.works) t.push(`${r.works} de proyecto`);
  if (r.ordenes.length) t.push('orden de ' + r.ordenes.slice(0, 4).join(', ') + (r.ordenes.length > 4 ? '…' : ''));
  return t.join(' · ');
}

// ---------- cabecera ----------
function cabecera() {
  if (!S.estado) return;
  $('#deshacer').disabled = !S.historia.length; $('#rehacer').disabled = !S.futuro.length;
  const r = resumen(), hay = hayCambios();
  $('#publicar').disabled = !hay || publicando;
  $('#estado').innerHTML = publicando ? 'Publicando…' : sinGuardar ? 'Guardando…' : hay ? `<b>${r.total || 1}</b> ${r.total === 1 ? 'cambio' : 'cambios'} sin publicar` : 'Todo publicado';
  $('#estado').title = hay ? textoResumen(r) : '';
  const n = [...S.fotos.keys()].filter(esNueva).length, b = $('#badgeNuevas');
  b.hidden = !n; b.textContent = n;
}

// ---------- publicar ----------
let publicando = false;
async function abrirPublicar() {
  await guardar();
  const r = resumen();
  const fila = (n, t, c) => (n ? `<li><b>${n}</b><span class="dot" style="--c:${c}"></span>${t}</li>` : '');
  modal(`<h2>Publicar</h2><p>Esto es lo que cambia en mikeance.com:</p>
    <ul class="res">${fila(r.nuevas, r.nuevas === 1 ? 'foto nueva en la web' : 'fotos nuevas en la web', 'var(--L)')}${fila(r.quitadas, r.quitadas === 1 ? 'foto sale de la web' : 'fotos salen de la web', 'var(--X)')}
    ${fila(r.secciones, 'con cambios de sección', 'var(--E)')}${fila(r.titulos, r.titulos === 1 ? 'nombre nuevo o cambiado' : 'nombres nuevos o cambiados', 'var(--P)')}${fila(r.works, 'cambian de proyecto', 'var(--W)')}
    ${r.ordenes.length ? `<li><b>${r.ordenes.length}</b><span class="dot" style="--c:var(--H)"></span>Orden: ${r.ordenes.join(', ')}</li>` : ''}</ul>
    <p style="font-size:12px;color:var(--mut)">Tarda uno o dos minutos. Puedes seguir mirando mientras tanto.</p>
    <div class="pie"><button class="btn" data-a="descartar" style="margin-right:auto">Descartar cambios</button><button class="btn" data-a="cerrar">Cancelar</button><button class="btn negro" data-a="ok">Publicar ahora</button></div>`, {
    ok: () => lanzar(textoResumen(r)),
    descartar: async () => { if (await confirmar('¿Descartar todos los cambios sin publicar? Se vuelve a lo que hay en la web.')) { S.historia.push(JSON.stringify(S.estado)); S.estado = clonar(S.publicadoNorm); normalizar(); guardarLuego(); avisar(); cerrarModal(); toast('Cambios descartados', true); } },
  });
}
async function lanzar(texto) {
  publicando = true; cabecera();
  const r = await (await fetch('/api/publicar', { method: 'POST', body: JSON.stringify({ resumen: texto }) })).json();
  if (r.error) { publicando = false; cabecera(); return toast(r.error); }
  seguir();
}
async function seguir() {
  const j = await (await fetch('/api/publicar')).json();
  const icon = { ok: '✓', error: '!', corriendo: '', pendiente: '' };
  const pasos = `<ol class="pasos">${(j.pasos || []).map((p) => `<li class="${p.estado}"><i>${icon[p.estado]}</i>${p.t}</li>`).join('')}</ol>`;
  if (j.estado === 'corriendo') {
    modal(`<h2>Publicando…</h2>${pasos}<details><summary style="color:var(--mut);font-size:11px;cursor:pointer">Ver detalles</summary><pre>${esc(j.log.slice(-60).join('\n'))}</pre></details>`, {}, true);
    return setTimeout(seguir, 1200);
  }
  publicando = false;
  if (j.estado === 'ok') {
    modal(`<h2>Publicado</h2>${pasos}<p>Los cambios ya están en mikeance.com (si no los ves, recarga la página).</p><div class="pie"><a class="btn" href="https://mikeance.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center">Ver mikeance.com ↗</a><button class="btn negro" data-a="cerrar">Hecho</button></div>`);
    await cargar(true);
  } else {
    modal(`<h2>No se ha podido publicar</h2>${pasos}<p>${esc(j.error || '')}. Tus cambios siguen guardados; puedes volver a intentarlo o pedírselo a Claude.</p><pre>${esc((j.log || []).slice(-40).join('\n'))}</pre><div class="pie"><button class="btn negro" data-a="cerrar">Cerrar</button></div>`);
    cabecera();
  }
}

// ---------- modal / toast / diálogos ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let accionesModal = {};
export function modal(html, acciones = {}, fijo = false) {
  $('#modalCaja').innerHTML = html; $('#modal').hidden = false; accionesModal = acciones; $('#modal').dataset.fijo = fijo ? '1' : '';
}
export function cerrarModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'cerrar' || (e.target.id === 'modal' && !$('#modal').dataset.fijo)) return cerrarModal();
  if (a && accionesModal[a]) accionesModal[a](e);
});
export function pedir(titulo, placeholder = '', valor = '') {
  return new Promise((res) => {
    modal(`<h2>${esc(titulo)}</h2><input id="pedirIn" placeholder="${esc(placeholder)}" value="${esc(valor)}"><div class="pie"><button class="btn" data-a="cerrar">Cancelar</button><button class="btn negro" data-a="ok">Aceptar</button></div>`, { ok: () => { const v = $('#pedirIn').value.trim(); cerrarModal(); res(v); } });
    const i = $('#pedirIn'); i.focus(); i.select();
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = i.value.trim(); cerrarModal(); res(v); } if (e.key === 'Escape') { cerrarModal(); res(null); } });
    const obs = new MutationObserver(() => { if ($('#modal').hidden) { obs.disconnect(); res(null); } }); obs.observe($('#modal'), { attributes: true });
  });
}
export function confirmar(texto) {
  return new Promise((res) => {
    modal(`<p style="font-size:14px;color:var(--fg);margin:4px 0 18px">${esc(texto)}</p><div class="pie"><button class="btn" data-a="no">Cancelar</button><button class="btn negro" data-a="si">Sí</button></div>`, { si: () => { cerrarModal(); res(true); }, no: () => { cerrarModal(); res(false); } });
  });
}
let tToast = 0;
export function toast(msg, conDeshacer = false) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${conDeshacer ? '<button id="toastUndo">Deshacer</button>' : ''}`;
  t.hidden = false; clearTimeout(tToast); tToast = setTimeout(() => (t.hidden = true), conDeshacer ? 6000 : 3500);
  if (conDeshacer) $('#toastUndo').onclick = () => { deshacer(); t.hidden = true; };
}

// ---------- rutas ----------
let desmontar = null;
function ruta() {
  const h = location.hash.replace(/^#\/?/, '') || 'web/H';
  const [tab, ...resto] = h.split('/');
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  if (desmontar) { desmontar(); desmontar = null; }
  const v = $('#vista');
  if (tab === 'todas') desmontar = vistaTodas(v, resto.join('/'));
  else if (tab === 'instagram') {
    v.innerHTML = '<div class="ig"><iframe src="/catalogo/instagram.html" title="Instagram"></iframe></div>';
    // el enlace «← catálogo» del editor lleva al catálogo antiguo: dentro del Estudio sobra
    v.querySelector('iframe').addEventListener('load', (e) => { try { e.target.contentDocument.head.insertAdjacentHTML('beforeend', '<style>a[href="index.html"]{display:none!important}</style>'); } catch {} });
  }
  else desmontar = vistaWeb(v, decodeURIComponent(resto.join('/')) || 'H');
  document.title = ({ todas: 'All pictures', instagram: 'Instagram feed' }[tab] || 'Miguel Antón') + ' · Estudio';
}
addEventListener('hashchange', ruta);

// ---------- teclado ----------
addEventListener('keydown', (e) => {
  const enCampo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !enCampo) { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
  if (e.key === 'Escape' && !$('#modal').hidden && !$('#modal').dataset.fijo) cerrarModal();
});
$('#deshacer').onclick = deshacer; $('#rehacer').onclick = rehacer;
$('#publicar').onclick = abrirPublicar;

// ---------- carga ----------
export async function cargar(tras = false) {
  const d = await (await fetch('/api/datos')).json();
  if (d.error) { $('#vista').innerHTML = `<div class="vacio">${esc(d.error)}</div>`; return; }
  S.datos = d; S.publicado = d.publicado; S.base = d.baseActual || d.borrador?.baseActual;
  S.fotos = new Map(d.fotos.map((f) => [f.p, f]));
  prepararWorks(d.works);
  // lo publicado, normalizado igual que el estado (para comparar)
  S.estado = clonar(d.publicado); normalizar(); S.publicadoNorm = clonar(S.estado);
  S.estado = clonar(d.estado); normalizar();
  if (tras) { S.historia = []; S.futuro = []; }
  const av = $('#aviso');
  if (d.borrador && d.borrador.base && d.borrador.base !== d.borrador.baseActual) {
    av.hidden = false;
    av.innerHTML = 'La web ha cambiado desde que guardaste estos cambios (por ejemplo, algo que ha hecho Claude). Si publicas, se aplicarán encima. <button id="avD">Descartar mis cambios</button><button id="avK">Mantenerlos</button>';
    $('#avD').onclick = async () => { await fetch('/api/estado', { method: 'DELETE' }); av.hidden = true; cargar(true); };
    $('#avK').onclick = () => { S.base = d.borrador.baseActual; guardarLuego(); av.hidden = true; document.body.classList.remove('conaviso'); };
  } else av.hidden = true;
  cabecera();
  ruta();
}
S.base = null;
$('#vista').innerHTML = '<div class="cargando">Cargando…</div>';
cargar().catch((e) => { $('#vista').innerHTML = `<div class="vacio">No se ha podido cargar: ${esc(e.message)}</div>`; });
// si ya había una publicación en marcha (p. ej. al recargar la página), se sigue
fetch('/api/publicar').then((r) => r.json()).then((j) => { if (j.estado === 'corriendo') { publicando = true; seguir(); } });
