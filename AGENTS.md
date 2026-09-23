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
