// Avisa a Bing (y demás buscadores de IndexNow: Yandex, Seznam, Naver…) de todas las páginas del sitemap publicado.
// Uso, después de publicar: node scripts/indexnow.mjs
// La clave está en public/<clave>.txt (se publica en https://mikeance.com/<clave>.txt).
import { readdirSync } from 'node:fs';

const HOST = 'mikeance.com';
const key = readdirSync(new URL('../public/', import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
if (!key) throw new Error('Falta la clave de IndexNow en public/');

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} páginas → ${res.status} ${res.statusText}`, (await res.text()).slice(0, 300));
