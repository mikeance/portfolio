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

## Estudio (plataforma interna de Miguel)

- App local: `estudio/server.mjs` (Node, http://localhost:4455) + `estudio/app/` (index.html, main.js, web.js, todas.js, inspector.js, estudio.css). Miguel la abre desde el Dock o el escritorio (`~/Applications/Estudio.app`, lo crea `estudio/crear-app.sh`; lanza `estudio/abrir.sh`, que reinicia el servidor si cambia `server.mjs`). En desarrollo: `preview_start` con la configuración «estudio».
- Secciones: MIGUEL ANTÓN (Portada, Editorial, Faces, Life y Works con sus colecciones; mosaico como la web, arrastrar para ordenar, panel para añadir), ALL PICTURES (todas las fotos de la web + «Nuevas»; nombre, secciones y proyecto por foto o en grupo) e INSTAGRAM FEED (`catalogo/instagram.html` en un iframe, tal cual).
- Estado = mismo formato que los exports: publicado en `catalogo/estado-actual.json`, borrador (se guarda solo) en `catalogo/estudio/borrador.json`. Marca `W` en `seleccion`: foto en la web sin categoría (solo en un work o en la portada).
- Works: `orden['W:<slug>']` = orden de la página del work/colección; `orden['V:<slug>']` = fila del hover (sección WORKS › HOVERS), independiente → `fotos/orden-hovers.json` → `hovW`/`hovS` en photos.json → `strip` en src/lib/works.ts. Sin `V:`, el hover son todas en el orden de la página.
- «Nuevas»: fotos añadidas a `~/Desktop/FOTO` después de crear la app (`catalogo/estudio/base.json` = lo que ya había). Solo se ve lo que está en la web y lo nuevo.
- Botón «Publicar»: `aplicar-seleccion.py <borrador> --no-ocultar --previo estado-actual.json` → prepare-photos + faces + orden-auto → catalog.mjs → instagram-datos.py → commit solo de `public/photos` y `src/data` → build en un worktree limpio de HEAD → `wrangler deploy` → IndexNow → el borrador pasa a `estado-actual.json`.
- Si Claude cambia la web a mano, debe actualizar también `catalogo/estado-actual.json` (si no, un borrador antiguo lo desharía; la app avisa cuando el borrador se hizo sobre otro estado publicado).
- `catalogo/index.html` redirige al Estudio; el catálogo antiguo sigue en `catalogo/index-antiguo.html`.

## Flujo de trabajo del portfolio (mikeance.com)

- Fotos originales en `~/Desktop/FOTO` (no se tocan). Copias para la web en `fotos/` (ignorado por git): `fotos/{faces,editorial,lifestyle,portada}` y `fotos/works/<NN NOMBRE>/[<NN COLECCIÓN>/]`.
- Catálogo local en `catalogo/` (antes con file://; ahora se usa el Estudio, ver arriba). Miguel exporta `~/Downloads/seleccion-fotos (N).json`.
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
- Pestañas del editor: Posts (editar), Orden (portadas en cuadrícula, arrastrar para reordenar), Perfil (vista previa 3:4), Stories. El número de cada post se puede editar para moverlo.
- Fotos antiguas de la cuenta (visibles y archivadas, de la exportación): `catalogo/instagram-antiguas.html` → «Exportar selección» (`instagram-antiguas.json`). Siguiente paso pendiente: buscar los originales en ~/Desktop/FOTO (no volver a subir las copias comprimidas de Instagram).
- Fotos ya publicadas en Instagram: `catalogo/instagram-publicadas.json` (ids de la web, cruzados con la exportación de la cuenta en `~/Desktop/RRSS`).
