// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://mikeance.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** sitemap.xml al terminar el build: todas las páginas y sus fotos (para Google Imágenes). */
/** Imágenes para compartir (og:image): JPG de 1200 px de las fotos que usan las páginas (/og/<id>.jpg). */
const ogImages = {
  name: 'og-images',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const sharp = (await import('sharp')).default;
      const { readdirSync, statSync, mkdirSync, existsSync } = await import('node:fs');
      const out = fileURLToPath(dir), ids = new Set();
      const walk = (d) => { for (const f of readdirSync(d)) { const p = d + f; if (statSync(p).isDirectory()) walk(p + '/'); else if (f.endsWith('.html')) for (const m of readFileSync(p, 'utf8').matchAll(/\/og\/([0-9a-f]{10})\.jpg/g)) ids.add(m[1]); } };
      walk(out);
      mkdirSync(`${out}og`, { recursive: true });
      for (const id of ids) {
        const src = `${out}photos/${id}-1600.webp`;
        if (existsSync(src)) await sharp(src).resize(1200, 1200, { fit: 'inside' }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${out}og/${id}.jpg`);
      }
      console.log(`og-images: ${ids.size} imágenes para compartir`);
    },
  },
};

const sitemap = {
  name: 'sitemap',
  hooks: {
    'astro:build:done': ({ dir, pages }) => {
      const out = fileURLToPath(dir);
      const today = new Date().toISOString().slice(0, 10);
      const urls = pages.map(({ pathname }) => {
        const path = '/' + pathname.replace(/^\/|\/$/g, '');
        const loc = SITE + (path === '/' ? '/' : path + '/');
        let html = '';
        try { html = readFileSync(`${out}${pathname ? pathname.replace(/\/?$/, '/') : ''}index.html`, 'utf8'); } catch {}
        const seen = new Set();
        const imgs = [...html.matchAll(/<img[^>]*src="(\/photos\/[^"]+)"[^>]*alt="([^"]*)"/g)]
          .filter(([, src]) => !seen.has(src) && seen.add(src)).slice(0, 1000)
          .map(([, src, alt]) => `<image:image><image:loc>${SITE}${esc(src.replace('-800.webp', '-1600.webp'))}</image:loc>${alt ? `<image:title>${esc(alt)}</image:title>` : ''}</image:image>`);
        const pri = path === '/' ? '1.0' : path.split('/').length > 3 ? '0.6' : '0.8';
        return `<url><loc>${loc}</loc><lastmod>${today}</lastmod><priority>${pri}</priority>${imgs.join('')}</url>`;
      });
      writeFileSync(`${out}sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [sitemap, ogImages],
  // estilos dentro del HTML: la página no espera a descargar una hoja aparte para pintarse
  build: { inlineStylesheets: 'always' },
});
