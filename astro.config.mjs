// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://mikeance.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** sitemap.xml al terminar el build: todas las páginas y sus fotos (para Google Imágenes). */
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
  integrations: [sitemap],
});
