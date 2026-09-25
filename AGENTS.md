## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Flujo de trabajo del portfolio (mikeance.com)

- Fotos originales en `~/Desktop/FOTO` (no se tocan). Copias para la web en `fotos/` (ignorado por git): `fotos/{faces,editorial,lifestyle,portada}` y `fotos/works/<NN NOMBRE>/[<NN COLECCIÓN>/]`.
- Catálogo local en `catalogo/` (abrir `catalogo/index.html`, `portada.html`, `textos.html` con file://). Miguel exporta `~/Downloads/seleccion-fotos (N).json`.
- Aplicar un export y publicar, en este orden:
  1. `python3 scripts/aplicar-seleccion.py "~/Downloads/seleccion-fotos (N).json"`
  2. `npm run photos` (prepare-photos + caras + orden automático) o solo `node scripts/prepare-photos.mjs`
  3. `node scripts/catalog.mjs`
  4. `npm run build` y `npx wrangler deploy`
  5. `git add -A && git commit && git push`
- Cambios hechos a mano en `fotos/works` (mover o renombrar carpetas) solo necesitan los pasos 2 a 5.
- Nunca ejecutar `wrangler pages …` (reescribe la configuración). El sitio es un Worker con assets estáticos (`wrangler.jsonc`, `worker/index.js`).
- Servidor de desarrollo: `astro dev --background` (ver arriba).

## Instagram (plan de posts)

- Editor: `catalogo/instagram.html` (file://). Posts con portada + carrusel, perfil 3:4 de vista previa, fotos sin usar a la derecha. Se guarda en el navegador; «Exportar plan» descarga `~/Downloads/instagram-plan (N).json`.
- Aplicar un export: `node scripts/instagram-aplicar.mjs "~/Downloads/instagram-plan (N).json"` → guarda `catalogo/instagram-plan.json`, regenera `catalogo/instagram-data.js` y las carpetas listas para subir en `~/Desktop/RRSS/carruseles/` (1080×1350, borde blanco, `pie.txt`).
- Tras cambiar fotos de la web: `python3 scripts/instagram-datos.py` (mantiene el plan). `--propuesta` rehace la propuesta automática desde cero.
- Diapositivas: `id` o díptico `id1+id2` (dos horizontales en un 4:5). Posts con `formato: 'h'` se exportan a 1080×720 (3:2).
- Stories: pestaña «Stories» del editor; la lógica (campaña de lanzamiento, 3 stories por post, encuesta de portada los sábados) está en `catalogo/instagram-stories.js`, compartida con el script de aplicar. Solo se guarda lo editado (`plan.campana`, `post.stories`). El export deja `stories/` (1080×1920) y `stories.txt` en cada carpeta, y carpetas `000 fecha Stories · …` para la campaña.
- Fotos ya publicadas en Instagram: `catalogo/instagram-publicadas.json` (ids de la web, cruzados con la exportación de la cuenta en `~/Desktop/RRSS`).
