# Matriz privada + versión cliente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el cotizador en una matriz local con biblioteca de clientes y una versión cliente publicada, de solo lectura, con fecha de generación y evidencias configurables.

**Architecture:** La matriz sigue siendo una app estática que se abre con `file://`; vive en la raíz del repo y guarda la biblioteca en `localStorage`. La versión cliente se genera como HTML con datos embebidos en `docs/c/<slug>/index.html` y se publica con GitHub Pages desde `/docs`. Un ayudante local en Node construye la página, hace commit/push y devuelve la URL; el mismo ayudante retira publicaciones.

**Tech Stack:** HTML/CSS/JavaScript clásico (sin bundler), Node 24 (`node:test`, `node:fs`), Playwright con el Chrome instalado para E2E, GitHub Pages, git/gh.

**Spec:** `specs/2026-10-27-matriz-cliente-design.md`

**Ubicación del plan:** `specs/` en lugar de `docs/superpowers/plans/` porque `docs/` es la raíz publicada en GitHub Pages.

## Global Constraints

- La matriz debe abrirse con doble clic (`file://`) sin servidor y sin build.
- No se añaden dependencias de runtime. Playwright se usa solo para pruebas y se resuelve del entorno global existente.
- No se commitean `node_modules`, paquetes descargados (`pandora-*.json`), respaldos (`pandora-biblioteca-*.json`), `tests/tmp/` ni `docs/c/_e2e/`.
- La versión cliente no debe contener `contenteditable`, `<input>`, `<textarea>`, `<select>`, botones de edición, importación o guardado. No se ocultan con CSS: no se generan.
- Los medios publicables son rutas bajo `docs/assets/` o URLs `https?://`. Se rechazan `blob:`, `file:`, `javascript:`, `vbscript:`, `data:video/*` y `data:image/*` mayor a 1.5 MB.
- La fecha de emisión es local (`YYYY-MM-DD`); el sello de generación es ISO UTC (`generatedAt`).
- La matriz no se publica: GitHub Pages se sirve desde `/docs`.
- El texto de la interfaz va en español; identificadores, archivos y commits en inglés.
- No hacer `git commit` ni `git push` sin autorización explícita del usuario. Los pasos de commit del plan se ejecutan solo si esa autorización está dada; si no, dejar los cambios en el working tree y pedirla.
- Mantener la identidad gráfica, las fuentes y los medios existentes.

## Review Focus

1. **Evidencia oculta:** con `mode: "none"`, ningún video, imagen ni URL de medio debe aparecer en el HTML del cliente, y una pieza `blob:` guardada solo en la matriz no debe bloquear la exportación.
2. **Secciones excluidas:** con `general` o `none`, la numeración `01, 02…` y los enlaces de navegación deben corresponder a las secciones realmente renderizadas; ningún `href="#..."` debe quedar roto.
3. **Slug estable:** cambiar el nombre del cliente después de publicar no debe cambiar la URL; un slug que ya pertenece a otro `quote-id` debe abortar la publicación.
4. **Medio inexistente:** una ruta `assets/...` que no exista en `docs/` debe fallar en la publicación con el nombre de la pieza y la ruta, no generar una página rota.
5. **Nombres largos y móvil:** un nombre de cliente largo no debe desbordar la portada, el docket ni la lista de la biblioteca a 360 px.

---

### Task 1: Utilidades compartidas y arnés de pruebas

**Files:**
- Create: `docs/app/core.js`
- Create: `tests/core.test.mjs`
- Create: `package.json`
- Modify: `js/store.js` (quitar utilidades duplicadas)
- Modify: `js/catalog.js` (envoltorio UMD y `P.uid`)
- Modify: `index.html` (cargar `docs/app/core.js` antes de `store.js`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `P.get(obj, path)`, `P.set(obj, path, value)`, `P.totals(quote) -> {subtotal, igv, grand, rate}`, `P.money(n) -> string`, `P.moneyS(n) -> string`, `P.parseNumber(v) -> number`, `P.dateLabel(iso) -> string`, `P.shortDate(iso) -> string`, `P.uid(prefix = 'b') -> string`, `P.slugify(text) -> string`, `P.uniqueSlug(text, suffix?) -> string`, `P.assetUrl(src, base) -> string`, `P.todayISO(now?) -> string`, `P.timeLabel(iso) -> string`, `P.clone(value) -> value`.
- `core.js` es UMD: en el navegador adjunta a `window.P`; en Node exporta con `module.exports`.

- [ ] **Step 1: Write the failing tests**

In `tests/core.test.mjs`, use `node:test`, `node:assert/strict` y `createRequire` para cargar `../docs/app/core.js`. Fijar `process.env.TZ = 'America/Lima'` antes de importar. Casos:

```js
test('money and totals', () => {
  assert.equal(P.money(7500), '7,500.00');
  assert.equal(P.moneyS(7500), 'S/ 7,500.00');
  assert.deepEqual(
    P.totals({ meta: { taxEnabled: true, taxRate: 18 }, blocks: [{ items: [{ amount: 5000 }, { amount: 2500 }] }] }),
    { subtotal: 7500, igv: 1350, grand: 8850, rate: 18 }
  );
});

test('slugify and uniqueSlug', () => {
  assert.equal(P.slugify('H&S Inmobiliaria'), 'h-s-inmobiliaria');
  assert.equal(P.slugify('Ñandú  Soluciones'), 'nandu-soluciones');
  assert.equal(P.slugify(''), 'cliente');
  assert.equal(P.uniqueSlug('H&S Inmobiliaria', 'a1b2'), 'h-s-inmobiliaria-a1b2');
});

test('assetUrl only prefixes relative paths', () => {
  assert.equal(P.assetUrl('assets/media/x.mp4', 'docs/'), 'docs/assets/media/x.mp4');
  assert.equal(P.assetUrl('https://youtu.be/x', 'docs/'), 'https://youtu.be/x');
  assert.equal(P.assetUrl('/assets/x.png', 'docs/'), '/assets/x.png');
});

test('local dates', () => {
  const d = new Date(2026, 9, 27, 23, 30);
  assert.equal(P.todayISO(d), '2026-10-27');
  assert.equal(P.dateLabel('2026-10-27'), '27 de octubre de 2026');
  assert.equal(P.timeLabel('2026-10-27T20:42:00.000Z'), '15:42');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/core.test.mjs`  
Expected: FAIL because `docs/app/core.js` does not exist.

- [ ] **Step 3: Implement `docs/app/core.js`**

Move the pure functions out of `js/store.js` without changing their behavior. `slugify` debe usar `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`, pasar a minúsculas, reemplazar todo lo que no sea `[a-z0-9]` por `-`, colapsar guiones y recortar a 40 caracteres. `uniqueSlug` agrega `-` + sufijo (o 4 caracteres aleatorios). `assetUrl` devuelve intacto lo que empiece con `http(s)://`, `data:`, `blob:`, `file:` o `/`; el resto lo prefija con `base`. `todayISO` usa componentes locales, no `toISOString().slice(0,10)`.

- [ ] **Step 4: Wire the matrix and remove duplicates**

En `index.html`, cargar `<script src="docs/app/core.js"></script>` antes de `js/store.js`. En `js/store.js`, borrar las definiciones de `get`, `set`, `totals`, `money`, `moneyS`, `parseNumber`, `MONTHS`, `dateLabel`, `shortDate`, `uid` y sus asignaciones a `P`; dejar solo el objeto `store` y usar `P.*`. En `js/catalog.js`, envolver el IIFE en UMD y cambiar `Math.random().toString(36)...` por `P.uid('b')` en `blockFromService`.

- [ ] **Step 5: Run the tests and a smoke check**

Run: `node --test tests/core.test.mjs`  
Expected: PASS (4 tests).  
Run: `node --check js/store.js && node --check js/catalog.js && node --check docs/app/core.js`  
Expected: exit 0.

- [ ] **Step 6: Commit (si está autorizado)**

```bash
git add docs/app/core.js tests/core.test.mjs package.json js/store.js js/catalog.js index.html .gitignore
git commit -m "refactor: extract shared quote core"
```

### Task 2: Mover assets, estilos y render a `docs/`

**Files:**
- Move: `assets/` → `docs/assets/`
- Move: `styles/app.css` → `docs/app/app.css`
- Move: `styles/print.css` → `docs/app/print.css`
- Move: `js/render.js` → `docs/app/render.js`
- Create: `tests/helpers/browser.mjs`
- Create: `tests/e2e.mjs`
- Modify: `index.html`, `js/app.js`, `docs/app/render.js`

**Interfaces:**
- Consumes: `P.assetUrl(src, base)` y `P.assetBase` de Task 1.
- Produces: la matriz carga `docs/app/core.js` y `docs/app/render.js`; `P.assetBase = 'docs/'`. `js/config.js` llega en Task 7.
- `tests/helpers/browser.mjs` exporta `launch()` y `newPage(browser)`.

- [ ] **Step 1: Move the files**

```bash
git mv assets docs/assets
mkdir -p docs/app
git mv styles/app.css docs/app/app.css
git mv styles/print.css docs/app/print.css
git mv js/render.js docs/app/render.js
rmdir styles
```

- [ ] **Step 2: Update the matrix paths**

En `index.html`:
- `assets/fonts.css` → `docs/assets/fonts.css`
- `styles/app.css` → `docs/app/app.css`
- `styles/print.css` → `docs/app/print.css`
- `assets/logo-mark.png`, `assets/logo-pandora.png`, `assets/favicon.svg` → `docs/assets/...`
- Antes de `js/catalog.js`, agregar `<script>window.P = { assetBase: 'docs/' };</script>` y `<script src="docs/app/core.js"></script>`.
- El `<script src="js/render.js">` pasa a `docs/app/render.js`.

En `docs/app/render.js`, envolver cada `video.src`, `video.poster`, `image.src` con `P.assetUrl(...)` al imprimir el HTML. En `js/app.js`, `openLightbox` y `playVideo` usan `P.assetUrl(video.src)` y `P.assetUrl(video.poster)`; `saveMedia` sigue guardando rutas relativas (`assets/...`) o URLs, nunca la ruta con `docs/`.

- [ ] **Step 3: Write the E2E helper and smoke test**

`tests/helpers/browser.mjs`:

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE
  || `${process.env.HOME}/.local/node/lib/node_modules/@playwright/mcp/node_modules/playwright-core`;
const { chromium } = require(playwrightPath);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const launch = () => chromium.launch({ executablePath: CHROME, headless: true });
```

`tests/e2e.mjs` abre la matriz con `file://`, espera `body.ready`, recolecta errores de consola y `requestfailed`, verifica que el logo tenga `naturalWidth > 0`, activa Editar, escribe `Cliente Prueba` en `[data-text="meta.client"]` con `locator.fill()`, espera 700 ms, recarga y verifica que el texto persista. Cierra el navegador en `finally`.

- [ ] **Step 4: Run the smoke test**

Run: `node tests/e2e.mjs`  
Expected: PASS, sin errores de consola ni requests fallidos. Si el logo no carga, revisar que `docs/assets/logo-mark.png` exista y que la ruta en `index.html` sea la nueva.

- [ ] **Step 5: Check the matrix still opens by double click**

Run: `open index.html`  
Expected: la misma pieza visual, sin 404 en la consola, edición y guardado funcionando. Cerrar la pestaña.

- [ ] **Step 6: Commit (si está autorizado)**

```bash
git add -A docs index.html js tests .gitignore
git commit -m "refactor: serve shared assets from docs"
```

### Task 3: Render de solo lectura, plantilla y generación de HTML

**Files:**
- Modify: `docs/app/render.js`
- Create: `docs/app/client.js`
- Create: `tools/cliente.template.html`
- Create: `tools/publicar-lib.mjs`
- Create: `tests/build.test.mjs`
- Modify: `tests/e2e.mjs`

**Interfaces:**
- Produces: `P.render.all(quote, opts)` con `opts = { readonly, view, evidenceMode, general }`.
  - `readonly: true` genera texto plano, sin `contenteditable`, sin `<input>`, sin `<select>`, sin botones de edición.
  - `view: 'editor' | 'client'`; el cliente usa `'client'`.
  - `evidenceMode: 'service' | 'general' | 'both' | 'none'`; por ahora el render implementa `'service'` y `'none'`; Task 6 agrega `'general'` y `'both'`.
  - `general: { videos: [], images: [] }`.
- Produces: `buildClientHtml({ template, pkg, base }) -> string` en `tools/publicar-lib.mjs`.
  - `pkg = { quote, general, slug, generatedAt }`.
  - `base` termina en `/`: `'../../'` para `docs/c/<slug>/`, `'./'` para `docs/index.html`.
- `docs/app/client.js` lee `window.__PANDORA__ = { quote, general, meta }` y no toca `localStorage`.

- [ ] **Step 1: Write the failing build test**

`tests/build.test.mjs` carga `P.defaultQuote()` con `require('../js/catalog.js')`, lee `tools/cliente.template.html`, llama `buildClientHtml` y afirma:

```js
assert.match(html, /<meta name="pandora-quote-id" content="q_test">/);
assert.match(html, /27 de octubre de 2026/);
assert.doesNotMatch(html, /\{\{/);
assert.match(html, /<\/script>/); // el JSON no rompe el script
assert.doesNotMatch(html, /contenteditable/);
```

Además, con un `quote.meta.client` que contenga `</script><script>alert(1)</script>`, el HTML no debe contener ese `<script>` literal.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/build.test.mjs`  
Expected: FAIL because `tools/publicar-lib.mjs` and the template do not exist.

- [ ] **Step 3: Implement the readonly render**

En `docs/app/render.js`, cambiar las firmas a `renderChapters(quote, opts)`, `renderPrices(quote, opts)`, `renderSplit(quote, opts)`, `renderBank(quote, opts)`, `renderConditions(quote, opts)` y `renderAll(quote, opts = {})`. Crear un helper local:

```js
function text(opts, path, value, cls) {
  return opts.readonly
    ? `<span class="txt${cls ? ' ' + cls : ''}">${esc(value)}</span>`
    : `<span class="editable${cls ? ' ' + cls : ''}" data-text="${path}">${esc(value)}</span>`;
}
```

Reglas concretas:
- Montos: en readonly, `<span class="price-amt"><span class="cur">S/</span> ${P.money(item.amount)}</span>`; sin `<input class="amt">`.
- Porcentajes: en readonly, `<span class="pay-pct">${pct}%</span>`; sin `pct-input`.
- Banco: en readonly, `<dd>` con el valor; sin botón “Copiar”.
- Listas: en readonly, sin `row-remove`, `add-entry`, `add-line`, `work-foot`, `add-service`.
- Medios: en readonly, sin botones “Reemplazar”; los `src`/`poster` pasan por `P.assetUrl`.
- Capítulos: `showService = opts.view === 'editor' || opts.evidenceMode === 'service' || opts.evidenceMode === 'both'`; `showGeneral = false` por ahora. Si `showService` es falso, no se genera la sección de evidencia. La numeración se calcula sobre lo generado. La navegación oculta el enlace `[href="#evidencia"]` cuando no hay sección.
- En el editor, el `print-stats` de Evidencia solo se incluye si `showService`; si no, se omite.
- `renderAll` llama a `sync(quote)` para totales y fecha; `sync` debe tolerar que no existan `.amt`, `.pct-input` ni `[data-text]`.

- [ ] **Step 4: Create the template and the client script**

`tools/cliente.template.html` es una copia de la estructura de `index.html` sin diálogos, sin `edit-only`, sin “Editar”, sin inputs de fecha, sin `edit-hint`. Incluye:
- `{{TITLE}}`, `{{DESCRIPTION}}`, favicon y CSS con `{{BASE}}`.
- `<meta name="pandora-quote-id" content="{{QUOTE_ID}}">`.
- `<time data-date>` y `<span data-generated-label>`.
- Navegación con “Resumen / Alcance / Evidencia / Otros trabajos / Inversión / Condiciones”.
- `<div id="chapters">`, `#price-groups`, `#paylist`, `#bank`, `#conditions`, lightbox.
- Antes de los scripts: `<script>window.P = { assetBase: '{{BASE}}' };</script>` y `<script>window.__PANDORA__ = {{DATA}};</script>`.
- Scripts: `{{BASE}}app/core.js`, `{{BASE}}app/render.js`, `{{BASE}}app/client.js`.
- Sin `js/catalog.js`, `js/store.js` ni `js/app.js`.

`docs/app/client.js`:
- `const { quote, general } = window.__PANDORA__;`
- `P.render.all(quote, { readonly: true, view: 'client', evidenceMode: quote.evidence?.mode || 'service', general });`
- Bind de `play-video`, `lightbox`, `close-lightbox`, `print` y `fullscreen`; sin guardado.
- `playVideo` resuelve el bloque con `data-block` y `data-index`; por ahora solo evidencia de servicio.
- `openLightbox` igual.
- `IntersectionObserver` para la navegación.
- No usar `localStorage`, `fetch` ni `XMLHttpRequest`.

`tools/publicar-lib.mjs`:
```js
export function buildClientHtml({ template, pkg, base }) {
  const data = JSON.stringify({ quote: pkg.quote, general: pkg.general, meta: { generatedAt: pkg.generatedAt } })
    .replace(/</g, '\\u003c');
  return template
    .replaceAll('{{TITLE}}', escapeHtml(`Propuesta · ${pkg.quote.meta.client}`))
    .replaceAll('{{DESCRIPTION}}', 'Propuesta de Pandora Marketing.')
    .replaceAll('{{QUOTE_ID}}', escapeHtml(pkg.quote.id || pkg.slug))
    .replaceAll('{{GENERATED_AT}}', escapeHtml(pkg.generatedAt))
    .replaceAll('{{BASE}}', base)
    .replace('{{DATA}}', data);
}
```
`escapeHtml` debe escapar `& < > "`. El `quote.id` se agrega al schema en Task 4; hasta entonces usar `pkg.slug`.

- [ ] **Step 5: Add the client E2E**

En `tests/e2e.mjs`, antes de las pruebas del cliente:
- Crear `docs/c/_e2e/` y escribir `index.html` con `buildClientHtml` y un `pkg` de `P.defaultQuote()` con `quote.meta.date = '2026-10-27'`, `general = { videos: [], images: [] }`, `base = '../../'`.
- Levantar `python3 -m http.server 4173 --directory docs` con `spawn`, esperar `http://127.0.0.1:4173/`.
- Abrir `http://127.0.0.1:4173/c/_e2e/` en un contexto nuevo.
- Afirmar: `input, textarea, select, [contenteditable="true"]` count 0; `getByText('Editar', { exact: true })` count 0; `[data-action="print"]` count 1; fecha `27 de octubre de 2026`.
- Click en el primer `[data-action="play-video"]`; esperar `.shot-frame video`; verificar `src` no vacío.
- Click en el primer `[data-action="lightbox"]`; `#lightbox` visible; click en `.lb-close`; oculto.
- `page.evaluate(() => Object.keys(localStorage).length)` === 0.
- Sin errores de consola.
- En `finally`: cerrar navegador, matar el servidor y borrar `docs/c/_e2e/`.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/build.test.mjs` → PASS.  
Run: `node tests/e2e.mjs` → PASS en matriz y cliente.

- [ ] **Step 7: Commit (si está autorizado)**

```bash
git add docs/app/render.js docs/app/client.js tools tests
git commit -m "feat: render read-only client pages"
```

### Task 4: Biblioteca de cotizaciones y migración

**Files:**
- Rewrite: `js/store.js`
- Modify: `js/catalog.js` (`newQuote`, `defaultQuote` v2)
- Modify: `index.html` (botón y diálogo de biblioteca)
- Modify: `js/app.js` (estado activo, biblioteca, respaldo)
- Modify: `docs/app/app.css`
- Create: `tests/store.test.mjs`
- Modify: `tests/e2e.mjs`

**Interfaces:**
- Produces: `P.library.KEY = 'pandora.biblioteca.v1'`, `P.library.OLD_KEY = 'pandora.cotizacion.v1'`, `P.library.MAX_VERSIONS = 10`.
- `P.library.load(storage?) -> Library`, `save(lib, storage?) -> boolean`, `active(lib) -> Entry`, `setActive(lib, id) -> Entry`, `add(lib, quote) -> Entry`, `duplicate(lib, id) -> Entry`, `remove(lib, id) -> boolean`, `update(lib, id, quote) -> Entry`, `snapshot(lib, id, label) -> Entry`, `restore(lib, id, at) -> Quote`.
- `Library = { version: 1, activeId, evidenceBank, quotes: Entry[] }`.
- `Entry = { id, name, updatedAt, quote, versions: [{ at, label, quote }] }`.
- `P.store` conserva la fachada usada por `app.js`: `lib`, `quote`, `load()`, `save()`, `reset()`, `switchTo(id)`, `emit()`, `onChange(fn)`.
- `P.newQuote(serviceId) -> Quote` en `catalog.js`.

- [ ] **Step 1: Write the failing store tests**

`tests/store.test.mjs` crea un storage falso en memoria y prueba:

```js
test('migrates the old single quote', () => {
  storage.setItem(P.library.OLD_KEY, JSON.stringify(oldV1Quote));
  const lib = P.library.load(storage);
  assert.equal(lib.quotes.length, 1);
  assert.equal(lib.activeId, lib.quotes[0].id);
  assert.equal(lib.quotes[0].quote.version, 2);
  assert.equal(lib.quotes[0].quote.evidence.mode, 'service');
  assert.equal(lib.quotes[0].quote.blocks[0].serviceName, 'Meta Ads');
});

test('add, duplicate and remove', () => {
  const lib = P.library.load(storage);
  const first = lib.activeId;
  P.library.add(lib, P.newQuote('branding'));
  assert.equal(lib.quotes.length, 2);
  assert.equal(lib.activeId, lib.quotes[1].id);
  P.library.duplicate(lib, first);
  assert.equal(lib.quotes.length, 3);
  assert.match(lib.quotes[2].name, /\(copia\)/);
  assert.equal(lib.quotes[2].quote.meta.slug, '');
  assert.equal(P.library.remove(lib, lib.quotes[2].id), true);
  assert.equal(P.library.remove(lib, lib.quotes[0].id), true);
  assert.equal(P.library.remove(lib, lib.quotes[0].id), false);
});

test('snapshots cap at ten and restore', () => {
  const lib = P.library.load(storage);
  for (let i = 0; i < 12; i += 1) P.library.snapshot(lib, lib.activeId, `v${i}`);
  assert.equal(lib.quotes[0].versions.length, 10);
  const at = lib.quotes[0].versions[0].at;
  const restored = P.library.restore(lib, lib.activeId, at);
  assert.equal(restored.id, lib.activeId);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/store.test.mjs`  
Expected: FAIL because `P.library` does not exist.

- [ ] **Step 3: Implement the store**

En `js/store.js`:
- UMD con `module.exports` para las pruebas; en el navegador adjunta `P.library` y `P.store`.
- `load(storage)`: parsea `KEY`; valida `version === 1`, `quotes` no vacío y `activeId`; si no, migra `OLD_KEY` o crea una biblioteca con `P.defaultQuote()`. Rellena `evidenceBank` si falta. Guarda el resultado. Si el `activeId` no existe, usa el primero.
- `migrateQuote(old)`: clona, `version = 2`, agrega `meta.slug/generatedAt/publishedUrl/publishedAt` vacíos, `evidence = { mode:'service', generalIds:{videos:[],images:[]} }`, asigna `id` a la cotización si falta y `serviceName` a cada bloque.
- `add(lib, quote)`: nuevo `id = 'q_' + P.uid('')`; asigna `quote.id = entry.id`; `name = quote.meta.client || 'Cliente sin nombre'`; `versions = []`; push; `activeId = entry.id`; devuelve entry.
- `duplicate`: clona; nuevo id; `quote.meta.client = name + ' (copia)'`; limpia `slug`, `publishedUrl`, `publishedAt`, `generatedAt`, `retiredAt`; `versions = []`; push; activa.
- `remove`: si `quotes.length <= 1` devuelve `false`; si era la activa, activa la primera; devuelve `true`.
- `update`: actualiza `entry.quote`, `entry.name`, `entry.updatedAt`; si `quote.id` falta, lo asigna.
- `snapshot`: `unshift({ at: new Date().toISOString(), label, quote: P.clone(entry.quote) })`; recorta a `MAX_VERSIONS`.
- `restore`: busca `at`; reemplaza `entry.quote` por el clon; actualiza `updatedAt`; devuelve el quote.
- `save`: `localStorage.setItem(KEY, JSON.stringify(lib))`; devuelve `false` si hay excepción.

En `P.store`:
```js
load() { this.lib = P.library.load(); this.quote = P.library.active(this.lib).quote; return this.quote; }
save() { P.library.update(this.lib, this.lib.activeId, this.quote); return P.library.save(this.lib); }
switchTo(id) { this.save(); P.library.setActive(this.lib, id); this.quote = P.library.active(this.lib).quote; this.emit(); }
```
`reset` reemplaza el quote activo por `P.defaultQuote()`, conserva `quote.id`, limpia slug/publicación, guarda y emite.

- [ ] **Step 4: Add `newQuote` and the v2 default**

En `js/catalog.js`, `defaultQuote()` devuelve `version: 2`, `id: ''`, `evidence: { mode: 'service', generalIds: { videos: [], images: [] } }`, `meta.slug/generatedAt/publishedUrl/publishedAt/retiredAt` vacíos, y cada bloque con `serviceName`. `newQuote(serviceId)` parte de una plantilla limpia: un bloque del servicio, `meta.client = 'Cliente sin nombre'`, `quoteNo = ''`, `lede = 'Propuesta de marketing con propósito.'`, `date = P.todayISO()`, `slug = ''`, `publishedUrl = ''`, `conditions` y `bank` por defecto.

- [ ] **Step 5: Add the library UI**

En `index.html`, agregar en `.topbar-actions` un botón `data-action="open-library"` con `<span data-library-count>1</span>`. Agregar el diálogo `#libraryDialog` (`.sheet.sheet-wide`) con `#libraryList`, botones `backup-library`, `import-library`, `new-quote` y el input `#libraryFile`.

En `js/app.js`:
- `init`: `quote = P.store.load();`.
- `saveNow`: `P.store.save()`.
- `renderLibrary()`: recorre `P.store.lib.quotes`; cada fila muestra nombre, servicios (`block.serviceName` únicos), fecha (`P.dateLabel`), URL si existe, estado y botones `open-quote`, `duplicate-quote`, `delete-quote`; la activa lleva `aria-current="true"`.
- `open-library` renderiza y abre el diálogo.
- `new-quote` abre `#serviceDialog` con `pickCtx = { mode: 'new' }`; `pick-service` con `mode === 'new'` llama `P.library.add(lib, P.newQuote(serviceId))`, guarda, cambia `quote`, cierra y refresca.
- `backup-library`: descarga `{ version: 1, exportedAt, evidenceBank, quotes }` como `pandora-biblioteca-YYYY-MM-DD.json`.
- `import-library`: valida, confirma “Reemplaza la biblioteca actual”, guarda, recarga el quote activo y refresca.
- `delete-quote`: `confirm` con advertencia “La página publicada, si existe, no se borra”; si es la última, toast y no borra.
- El botón `reset` del pie sigue existiendo, pero ahora restablece solo la cotización activa.
- El pie muestra “Guardado en este navegador · <hora>” (reemplaza el texto actual de `edit-hint`); se actualiza en cada `saveNow()` exitoso y muestra un aviso si falla.

CSS: `.library-list`, `.library-row`, `.library-main`, `.library-meta`, `.status-pill`, `.library-actions`; en móvil, acciones en una fila inferior. El nombre largo usa `overflow-wrap:anywhere` y no debe desbordar.

- [ ] **Step 6: Extend the E2E**

En `tests/e2e.mjs`, con un contexto limpio:
- Abrir la matriz; `body.ready`; `[data-library-count]` debe ser `1`.
- Abrir biblioteca; “Nueva cotización” → elegir Branding; el cliente queda “Cliente sin nombre”; editarlo a “Cliente Beta”; esperar guardado.
- Abrir biblioteca; duplicar la primera; debe haber 3; la copia contiene “(copia)”.
- Cambiar a la primera; recargar; el nombre activo persiste y el contador sigue en 3.
- Descargar respaldo; leer el JSON; `quotes.length === 3`.
- Intentar eliminar hasta quedar una; el último intento muestra toast y no elimina.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/store.test.mjs` → PASS.  
Run: `node tests/e2e.mjs` → PASS.

- [ ] **Step 8: Commit (si está autorizado)**

```bash
git add js/store.js js/catalog.js js/app.js index.html docs/app/app.css tests
git commit -m "feat: add quote library with migration"
```

### Task 5: Banco de evidencias y control de modos

**Files:**
- Modify: `js/catalog.js` (`seedEvidenceBank`)
- Modify: `js/store.js` (`removeBankPiece`, seed on load)
- Modify: `index.html` (botón y diálogo de evidencias, campo de servicio en el diálogo de medios)
- Modify: `js/app.js` (banco, selección, modos, medios del banco)
- Modify: `docs/app/app.css`
- Create: `tests/evidence.test.mjs`
- Modify: `tests/e2e.mjs`

**Interfaces:**
- Produces: `P.seedEvidenceBank() -> { videos: Piece[], images: Piece[] }`; `Piece = { id, title, src, poster?, service }`.
- Produces: `P.library.removeBankPiece(lib, kind, id) -> boolean`, que también limpia el id de `generalIds` en todas las cotizaciones.
- `quote.evidence = { mode, generalIds: { videos: [id], images: [id] } }`.
- `P.store.lib.evidenceBank` es el banco global.

- [ ] **Step 1: Write the failing tests**

`tests/evidence.test.mjs`:

```js
test('seed has one video and one image per service', () => {
  const bank = P.seedEvidenceBank();
  assert.equal(bank.videos.length, 5);
  assert.equal(bank.images.length, 5);
  assert.ok(bank.videos.every((p) => p.id && p.src && p.service));
});

test('removing a bank piece cleans quote selections', () => {
  const lib = P.library.load(fakeStorage);
  const piece = lib.evidenceBank.videos[0];
  lib.quotes[0].quote.evidence.generalIds.videos = [piece.id, 'e_other'];
  assert.equal(P.library.removeBankPiece(lib, 'videos', piece.id), true);
  assert.equal(lib.evidenceBank.videos.some((p) => p.id === piece.id), false);
  assert.deepEqual(lib.quotes[0].quote.evidence.generalIds.videos, ['e_other']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/evidence.test.mjs`  
Expected: FAIL because `seedEvidenceBank` does not exist.

- [ ] **Step 3: Implement the seed and the store helper**

En `js/catalog.js`, `seedEvidenceBank()` toma `videos[0]` e `images[0]` de cada servicio del catálogo, con `id: P.uid('e')`, `title: '<Servicio> — <título>'`, `service: '<Servicio>'`. En `P.library.load`, si `lib.evidenceBank` falta o está vacío, asígnalo con `P.seedEvidenceBank()`. `removeBankPiece` filtra el arreglo y recorre `lib.quotes` para quitar el id de `quote.evidence.generalIds[kind]`.

- [ ] **Step 4: Add the evidence UI**

En `index.html`, agregar el botón `data-action="open-evidence"` en `.topbar-actions` y el diálogo `#evidenceDialog` (`.sheet.sheet-wide`). Contenido:
- Título “Evidencias” y nota “Lo que verá el cliente”.
- Segmentado con cuatro botones `data-mode="service|general|both|none"` y etiquetas “Servicio / General / Ambas / Ocultar”.
- Botón `data-action="toggle-new-client"` con `aria-pressed`.
- Dos columnas: “Banco general” (`#bankList`) y “En esta cotización” (`#evidenceSelection`).
- En el banco: listas de videos e imágenes, cada pieza con título, servicio, botones “Reemplazar” y “Quitar”, y botones “+ Video” / “+ Imagen”.
- En la selección: checkbox por pieza, “Seleccionar todo” y “Ninguna”.
- Pie “Listo”.

En `js/app.js`:
- `renderEvidence()` pinta ambas columnas desde `P.store.lib.evidenceBank` y `quote.evidence`.
- `open-evidence` abre el diálogo.
- `data-mode` actualiza `quote.evidence.mode`, guarda, re-renderiza el diálogo y llama a la misma función `refresh()` que usa el editor para repintar el documento.
- `toggle-new-client`: si el modo es `general`, pasa a `service`; si no, pasa a `general` y, solo si ambas listas de `generalIds` están vacías, selecciona todos los ids del banco. Guarda y refresca.
- Los checkboxes actualizan `generalIds[kind]`; los botones “Seleccionar todo/Ninguna” operan sobre el kind correspondiente.
- `renderEvidence` muestra una nota cuando el modo es `none`: “No se mostrará evidencia en la versión cliente”.
- El botón del topbar muestra un punto/contador si hay piezas seleccionadas; no es obligatorio.

- [ ] **Step 5: Extend the media dialog for the bank**

`openMediaDialog(context)` acepta `{ bank: true, kind, index }` además del contexto de bloque. El formulario muestra un `<select name="service">` con las 5 etiquetas del catálogo + “General” solo cuando `context.bank`. `saveMedia` escribe en `P.store.lib.evidenceBank[kind]` o en `quote.blocks[bi][kind]`; al agregar al banco asigna `id: P.uid('e')` y `service`. `deleteMedia` usa `P.library.removeBankPiece` cuando es banco. El `<input type="file">` sigue siendo solo vista previa; el aviso dice que para publicar debe copiarse a `docs/assets/media/general/` y usarse la ruta.

- [ ] **Step 6: Extend the E2E**

- Abrir Evidencias; el banco debe tener 5 videos y 5 imágenes.
- Pulsar `data-mode="general"`; el botón queda `aria-pressed="true"`.
- Pulsar `Seleccionar todo` de videos; recargar; la selección persiste.
- Pulsar `Modo cliente nuevo` estando en `general`: vuelve a `service` y conserva la selección; pulsarlo de nuevo: vuelve a `general` y no borra la selección.
- Quitar una pieza del banco; la selección de las cotizaciones ya no la contiene.
- El diálogo no debe romper la edición ni el guardado.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/evidence.test.mjs` → PASS.  
Run: `node tests/e2e.mjs` → PASS.

- [ ] **Step 8: Commit (si está autorizado)**

```bash
git add js/catalog.js js/store.js js/app.js index.html docs/app/app.css tests
git commit -m "feat: add shared evidence bank and modes"
```

### Task 6: “Otros trabajos”, ocultar evidencia y payload del cliente

**Files:**
- Modify: `docs/app/render.js` (sección general, badges, navegación)
- Modify: `docs/app/client.js` (piezas generales)
- Modify: `docs/app/core.js` (`buildClientPayload`, `validateMedia`)
- Create: `tests/payload.test.mjs`
- Modify: `tests/e2e.mjs`

**Interfaces:**
- Produces: `P.buildClientPayload(quote, { bank, now }) -> { quote, general, slug, generatedAt }`.
  - `quote.meta.date = P.todayISO(now)`, `quote.meta.generatedAt = now.toISOString()`.
  - `quote.meta.slug = quote.meta.slug || P.uniqueSlug(quote.meta.client)`.
  - `mode: 'service'` → conserva `blocks[].videos/images`, `general` vacío.
  - `mode: 'general'` → `blocks[].videos/images = []`, `general` con las piezas seleccionadas.
  - `mode: 'both'` → conserva ambos.
  - `mode: 'none'` → ambos vacíos.
  - Las piezas generales se filtran por `quote.evidence.generalIds` y por existencia en el banco.
- Produces: `P.validateMedia(payload, { exists } = {}) -> Array<{ title, src, reason }>`.
  - `reason`: `'blob' | 'data-video' | 'data-image-size' | 'scheme' | 'missing'`.
  - `exists(pathRelativeToDocs) -> boolean` es opcional; la matriz no lo pasa, el generador sí.

- [ ] **Step 1: Write the failing payload tests**

```js
test('service mode keeps service media and drops the bank', () => {
  const q = P.defaultQuote();
  q.evidence.mode = 'service';
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: new Date(2026, 9, 27, 15, 0) });
  assert.ok(p.quote.blocks[0].videos.length >= 2);
  assert.equal(p.general.videos.length, 0);
  assert.equal(p.quote.meta.date, '2026-10-27');
});

test('none mode strips every media and does not block on blob', () => {
  const q = P.defaultQuote();
  q.evidence.mode = 'none';
  q.blocks[0].videos = [{ title: 'temporal', src: 'blob:http://x/y' }];
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: new Date() });
  assert.equal(p.quote.blocks[0].videos.length, 0);
  assert.equal(p.general.videos.length, 0);
  assert.deepEqual(P.validateMedia(p), []);
});

test('included blob is rejected', () => {
  const q = P.defaultQuote();
  q.blocks[0].videos[0].src = 'blob:http://x/y';
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: new Date() });
  assert.deepEqual(P.validateMedia(p).map((e) => e.reason), ['blob']);
});

test('missing asset is reported with the path', () => {
  const q = P.defaultQuote();
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: new Date() });
  const errors = P.validateMedia(p, { exists: () => false });
  assert.ok(errors.some((e) => e.reason === 'missing' && e.src.startsWith('assets/')));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/payload.test.mjs`  
Expected: FAIL because `buildClientPayload` does not exist.

- [ ] **Step 3: Implement the payload and validation**

En `docs/app/core.js`, `buildClientPayload` clona con `P.clone`, fija fecha/slug, y según el modo vacía `blocks[].videos`, `blocks[].images` y `general`. No muta el quote original. `general` se construye desde `bank.videos.filter(p => ids.includes(p.id))` y lo mismo para imágenes. `validateMedia` recorre `payload.quote.blocks[].videos/images` y `payload.general`; para cada `src`:
- `blob:` → `blob`
- `data:video/` → `data-video`
- `data:image/` → calcular bytes con `Math.ceil((src.length - src.indexOf(',') - 1) * 3 / 4)`; > 1.5 MB → `data-image-size`
- `javascript:`, `vbscript:`, `file:` o esquema desconocido → `scheme`
- `assets/` con `exists && !exists('docs/' + src)` → `missing`
- `http(s)://` → ok
Devuelve `{ title: piece.title || 'Pieza', src, reason }`.

- [ ] **Step 4: Render the general section and hide modes**

En `docs/app/render.js`:
- `showService = opts.view === 'editor' || mode === 'service' || mode === 'both'`.
- `hasGeneral = general.videos.length + general.images.length > 0`.
- `showGeneral = hasGeneral && (opts.view === 'editor' || mode === 'general' || mode === 'both')`.
- La sección general va después de los capítulos de servicio, con `id="otros-trabajos"`, título “Otros trabajos”, contador y el mismo `work-grid`.
- Cada pieza general lleva `data-general="1"` y `data-index`; los botones de reproducción/lightbox usan `data-general="1"`. En el editor, las piezas generales no tienen edición inline; se administran en el diálogo de evidencias.
- En el editor, si el modo es `general` o `none`, la sección de servicio lleva un badge “Oculto en la versión cliente”; si el modo es `service` o `none`, la sección general lleva el mismo badge.
- En el cliente (`readonly`), no se generan badges.
- La navegación: `[data-nav][href="#evidencia"]` oculta si `!showService`; `[data-nav][href="#otros-trabajos"]` oculta si `!showGeneral`.
- El `print-stats` de la sección de alcance solo incluye Evidencia si `showService`. La sección general incluye su propio `print-stats` con videos/piezas.
- La numeración se calcula en el orden: alcance, evidencia (si), otros trabajos (si), inversión, condiciones.

En `docs/app/client.js`:
- `playVideo` y `openLightbox` resuelven `data-general="1"` contra `general.videos/images`; el resto contra `quote.blocks[bi]`.
- El handler de click lee `dataset.general`.

- [ ] **Step 5: Extend the client E2E for the four modes**

En `tests/e2e.mjs`, construir cuatro páginas en `docs/c/_e2e-<mode>/` con el mismo quote y banco:
- `service`: `.section-work` ≥ 1; `#otros-trabajos` count 0.
- `general`: `#otros-trabajos` count 1; `.section-work` count 0; `[data-nav][href="#evidencia"]` hidden; el botón de play general abre un `<video>` o iframe.
- `both`: ambos presentes.
- `none`: ni `.section-work` ni `#otros-trabajos`; `document.documentElement.innerHTML` no contiene `assets/media`; los dos enlaces de navegación están hidden.
- En `none`, `window.__PANDORA__` no debe contener `assets/media`; verificar con `page.evaluate(() => JSON.stringify(window.__PANDORA__).includes('assets/media')) === false`.
- Sin errores de consola en ninguna.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/payload.test.mjs` → PASS.  
Run: `node tests/e2e.mjs` → PASS.

- [ ] **Step 7: Commit (si está autorizado)**

```bash
git add docs/app/core.js docs/app/render.js docs/app/client.js tests
git commit -m "feat: render general evidence and hidden mode"
```

### Task 7: Diálogo de exportación, paquete e historial

**Files:**
- Create: `js/config.js`
- Modify: `index.html` (botón “Exportar cliente”, diálogo `#publishDialog`, diálogo `#historyDialog`)
- Modify: `js/app.js` (slug, paquete, snapshot, historial, descarga)
- Modify: `docs/app/app.css`
- Modify: `tests/e2e.mjs`

**Interfaces:**
- `js/config.js`: `window.P = window.P || {}; P.siteBase = 'https://felipeflv.github.io/cotizacion-pandora';`
- `P.store.save()` actualiza la entrada activa.
- `P.library.snapshot(lib, id, label)` y `P.library.restore(lib, id, at)` de Task 4.
- Paquete descargado:
  ```json
  { "kind": "pandora-cliente", "version": 1, "slug": "...", "generatedAt": "...", "quote": {}, "general": { "videos": [], "images": [] } }
  ```
- Paquete de retiro:
  ```json
  { "kind": "pandora-retiro", "version": 1, "slug": "...", "quoteId": "q_...", "client": "...", "generatedAt": "..." }
  ```

- [ ] **Step 1: Add config and the topbar action**

Crear `js/config.js` y cargarlo después de `docs/app/core.js`. En `index.html`, agregar el botón `data-action="open-publish"` como primario (“Exportar cliente”) y mover “Exportar PDF” a un botón ghost/icono. Mantener pantalla completa.

Quitar el input de fecha (`meta.date`): en su lugar, un `<time>` de solo lectura con la fecha de hoy seguido de “Se actualizará al exportar”. El valor de `meta.date` solo lo escribe `downloadPackage()`.

- [ ] **Step 2: Build the publish dialog**

Agregar `#publishDialog` con: resumen (cliente, servicios, fecha de hoy, modo de evidencia), `#publishUrl`, `#publishErrors`, la instrucción de arrastrar el paquete y los botones `close-publish` / `download-package`.

`openPublish()` en `js/app.js`:
- Exige `quote.meta.client.trim()`; si falta, toast y foco en el nombre.
- `ensureSlug()`: si `quote.meta.slug` está vacío, genera `P.uniqueSlug(client)` y repite si ya existe en `P.store.lib.quotes` (comparando `meta.slug`).
- `now = new Date()`; `payload = P.buildClientPayload(quote, { bank: lib.evidenceBank, now })`.
- `errors = P.validateMedia(payload)`; si hay, mostrarlos en `#publishErrors` (título + motivo + corrección) y deshabilitar la descarga.
- URL: `P.siteBase + '/c/' + slug + '/'`.
- Resumen del modo: “Servicio”, “General”, “Ambas”, “Ocultar”.

- [ ] **Step 3: Download the package**

`downloadPackage()`:
- Vuelve a construir el payload con un `now` nuevo.
- Asigna `quote.meta.date = payload.quote.meta.date`, `quote.meta.generatedAt = payload.generatedAt`, `quote.meta.slug = payload.slug`, `quote.meta.publishedUrl = url`, `quote.meta.publishedAt = payload.generatedAt`, `quote.meta.retiredAt = ''`.
- `P.library.snapshot(P.store.lib, P.store.lib.activeId, P.dateLabel(quote.meta.date))`; `P.store.save()`.
- `pkg = { kind: 'pandora-cliente', version: 1, ...payload }`.
- Descarga `pandora-<slug>-<YYYYMMDD-HHmm>.json` con `Blob` + `<a download>`.
- Cierra el diálogo, refresca la biblioteca y muestra un toast con el siguiente paso. Si el navegador bloquea la descarga, mostrar la URL y el error.

- [ ] **Step 4: Add the retire action**

En la biblioteca, cada cotización con `meta.slug` y `meta.publishedUrl` muestra `data-action="retire-quote"` con `data-id`. El diálogo de confirmación advierte: “La URL dejará de funcionar. La cotización y su historial siguen en esta Mac.” Al confirmar:
- `pkg = { kind: 'pandora-retiro', version: 1, slug: quote.meta.slug, quoteId: quote.id, client: quote.meta.client, generatedAt: new Date().toISOString() }`;
- descarga `pandora-retiro-<slug>.json`;
- asigna `quote.meta.retiredAt = pkg.generatedAt` y guarda (el estado visible pasa a “retirada”);
- no borra la cotización ni toca `publishedUrl` (sirve para reintentar o republicar).

En `renderLibrary()`, el estado se calcula así: `retiredAt` → “Retirada”; `publishedUrl` → “Publicada”; si no, “Sin publicar”. Publicar de nuevo limpia `retiredAt`.

- [ ] **Step 5: Add the history dialog**

En cada fila de la biblioteca, si `versions.length > 0`, mostrar “Historial (N)” con `data-action="open-history"` y `data-id`. `#historyDialog` lista `at`, `label` y un botón “Restaurar”. `restore-version` pide confirmación, llama `P.library.restore`, guarda, actualiza `quote`, cierra y refresca. Restaurar no cambia la URL publicada hasta volver a exportar.

- [ ] **Step 6: Extend the E2E**

- Crear/editar una cotización “Cliente 01”; abrir “Exportar cliente”; verificar que la URL contiene `/c/` y el slug.
- `page.waitForEvent('download')`; leer el JSON; afirmar `kind`, `version: 1`, `quote.meta.client === 'Cliente 01'`, `quote.meta.date === P.todayISO()`, `quote.meta.publishedUrl` y que `general` respeta el modo.
- Verificar que se agregó un snapshot (abrir historial; count 1).
- Exportar de nuevo; historial count 2; restaurar la versión anterior; el cliente vuelve al valor anterior.
- Insertar un `blob:` en `quote.blocks[0].videos[0].src` por `page.evaluate` (usando `P.store.quote`), abrir exportar: `#publishErrors` visible y `download-package` deshabilitado. Cambiar el modo a `none`, abrir de nuevo: sin errores y descarga habilitada.
- Pulsar “Retirar publicación” en una cotización con URL: se descarga `pandora-retiro-<slug>.json` con `kind: "pandora-retiro"` y el `quoteId` correcto; el estado de la fila pasa a “Retirada”; la cotización sigue en la biblioteca.

- [ ] **Step 7: Run the E2E**

Run: `node tests/e2e.mjs`  
Expected: PASS, incluida la descarga y el bloqueo por `blob:`.

- [ ] **Step 8: Commit (si está autorizado)**

```bash
git add js/config.js js/app.js index.html docs/app/app.css tests
git commit -m "feat: export client package with history"
```

### Task 8: Generador, ayudante de publicación y retiro

**Files:**
- Modify: `tools/publicar-lib.mjs`
- Create: `tools/publicar.mjs`
- Create: `tools/Publicar cliente.command`
- Create: `tests/publicar.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- `validatePackage(pkg) -> string[]` (errores legibles).
- `resolveSlug(pkg) -> string` (usa `pkg.slug`; exige `/^[a-z0-9][a-z0-9-]{1,63}$/`).
- `buildClientHtml({ template, pkg, base }) -> string` (Task 3).
- `prepareClient({ repoRoot, pkg, templatePath, base = '../../', force = false, outDir }) -> { file, html }`.
- `retireClient({ repoRoot, pkg, force = false, dryRun = false }) -> { dir }`.
- `readSiteBase(repoRoot) -> string`.
- `pageUrl(siteBase, slug) -> string` (`${siteBase}/c/${slug}/`).
- CLI: `node tools/publicar.mjs <archivo> [--dry-run] [--no-push] [--force] [--open] [--out <dir>]`.

- [ ] **Step 1: Write the failing generator tests**

Crear también `tests/fixtures/cliente.json` con un paquete mínimo válido (`kind: "pandora-cliente"`, `version: 1`, `slug: "demo"`, `generatedAt`, `quote` de `P.defaultQuote()` con `id: "q_test"`, `general: { videos: [], images: [] }`) y `tests/fixtures/retiro.json` (`kind: "pandora-retiro"`, `slug: "demo"`, `quoteId: "q_test"`, `generatedAt`). Se usan en las pruebas y en el dry run de Step 6.

`tests/publicar.test.mjs` usa `node:test`, `fs.mkdtempSync` en `os.tmpdir()` y un repo temporal con `docs/` y `js/config.js`. Casos:

```js
test('builds docs/c/<slug>/index.html with quote id', () => {
  const { file } = prepareClient({ repoRoot, pkg, templatePath, outDir: repoRoot });
  const html = readFileSync(file, 'utf8');
  assert.match(html, /pandora-quote-id" content="q_test"/);
  assert.match(html, /href="..\/..\/app\/app.css"/);
});

test('collision with another quote id throws', () => {
  writeFileSync(path.join(repoRoot, 'docs/c/demo/index.html'), '<meta name="pandora-quote-id" content="q_other">');
  assert.throws(() => prepareClient({ repoRoot, pkg: { ...pkg, slug: 'demo' }, templatePath }), /otra cotización/);
});

test('missing asset throws with title and path', () => {
  pkg.quote.blocks[0].images[0].src = 'assets/media/nope.png';
  assert.throws(() => prepareClient({ repoRoot, pkg, templatePath }), /nope\.png/);
});

test('retire removes the folder only for the same quote id', () => {
  prepareClient({ repoRoot, pkg, templatePath });
  assert.throws(() => retireClient({ repoRoot, pkg: { ...pkg, quote: { ...pkg.quote, id: 'q_other' } } }), /otra cotización/);
  retireClient({ repoRoot, pkg });
  assert.equal(existsSync(path.join(repoRoot, 'docs/c/demo')), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/publicar.test.mjs`  
Expected: FAIL because `prepareClient` does not exist.

- [ ] **Step 3: Implement the library**

`validatePackage` comprueba `kind`, `version === 1`, `quote.meta.client`, `quote.blocks.length`, slug y `generatedAt` válido. `prepareClient`:
- Resuelve `slug`; `dir = path.join(outDir || repoRoot, 'docs', 'c', slug)`.
- Lee `index.html` existente; si tiene `pandora-quote-id` distinto y `!force`, lanza `Error('El slug ya pertenece a otra cotización')`.
- Recorre `pkg.quote.blocks[].videos/images` y `pkg.general.videos/images`; para cada `src` que empiece con `assets/`, exige `existsSync(path.join(repoRoot, 'docs', src))`; si falta, lanza `Error('No existe el medio "<title>": <src>')`. Reutiliza `P.validateMedia(pkg, { exists })` de `docs/app/core.js` (UMD) en lugar de repetir las reglas de esquema y tamaño; solo agrega la comprobación de existencia.
- `html = buildClientHtml({ template, pkg, base })`; `mkdirSync(dir, {recursive:true})`; `writeFileSync(dir/index.html, html)`.
- Devuelve `{ file, html }`.

`retireClient`:
- `dir = path.join(repoRoot, 'docs', 'c', slug)`; si no existe, lanza.
- Lee el `index.html`; si el `quote-id` no coincide y `!force`, lanza.
- Si `dryRun`, devuelve `{ dir }` sin borrar; si no, `rmSync(dir, {recursive:true, force:true})`.

`readSiteBase` lee `js/config.js` y extrae `/P\.siteBase\s*=\s*['"]([^'"]+)['"]/`.

- [ ] **Step 4: Implement the CLI**

`tools/publicar.mjs`:
- `repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`.
- Parsea flags y el primer argumento no-flag.
- Lee el JSON; si `kind === 'pandora-retiro'` → `retireClient`, commit `Retirar <client> — <date>`, push, imprime “Publicación retirada” y la URL que deja de existir.
- Si es cliente → `prepareClient`, commit `Publicar <client> — <date>`, push.
- Git con `spawnSync('git', [...], { cwd: repoRoot, stdio: 'inherit' })`. Antes de commit, `git diff --cached --quiet`; si no hay cambios, omitir commit. `--no-push` omite push. `--dry-run` escribe el HTML y omite todo git (ni add, ni commit, ni push), para revisar la página antes de publicar.
- Imprime `pageUrl(readSiteBase(repoRoot), slug)`, la copia con `spawnSync('pbcopy', { input: url })` y, con `--open`, `spawn('open', [url])` con la nota “GitHub Pages puede tardar un minuto”.
- Errores: salir con código 1, mensaje claro y sin borrar el paquete.

- [ ] **Step 5: Create the `.command`**

```zsh
#!/bin/zsh
cd "$(dirname "$0")/.." || exit 1
FILE="$1"
if [[ -z "$FILE" ]]; then
  FILE=$(osascript -e 'POSIX path of (choose file with prompt "Elige el paquete del cliente" default location (path to downloads folder))') || exit 1
fi
node tools/publicar.mjs "$FILE" --open
STATUS=$?
echo
echo "Pulsa una tecla para cerrar..."
read -k 1
exit $STATUS
```

`chmod +x "tools/Publicar cliente.command"`.

- [ ] **Step 6: Add ignores and run the tests**

`.gitignore` agrega `node_modules/`, `tests/tmp/`, `pandora-*.json`, `pandora-biblioteca-*.json`, `docs/c/_e2e*/`.

Run: `node --test tests/publicar.test.mjs` → PASS.  
Run: `node --check tools/publicar.mjs && node --check tools/publicar-lib.mjs` → exit 0.  
Run a dry run with a fixture: `node tools/publicar.mjs tests/fixtures/cliente.json --dry-run --out tests/tmp` → escribe `tests/tmp/docs/c/<slug>/index.html` sin tocar git.

- [ ] **Step 7: Commit (si está autorizado)**

```bash
git add tools tests .gitignore
git commit -m "feat: add publish and retire helper"
```

### Task 9: Migración de la URL actual, Pages en `/docs` y README

**Files:**
- Create: `docs/index.html` (redirect a la página de H&S)
- Create: `docs/robots.txt`
- Create: `docs/.nojekyll`
- Create: `docs/c/hs-<suffix>/index.html` (generado por el ayudante)
- Modify: `js/catalog.js` (cotización semilla = H&S con slug fijo)
- Modify: `js/store.js` (`migrateQuote` aplica el slug heredado)
- Modify: `.gitignore`
- Rewrite: `README.md`

**Interfaces:**
- Consume: `tools/publicar.mjs` (Task 8), `buildClientHtml` (Task 3), `P.buildClientPayload` (Task 6).
- Produce: `docs/index.html` con `<meta http-equiv="refresh" content="0; url=./c/<slug>/">`, `<link rel="canonical" href="./c/<slug>/">`, `<meta name="robots" content="noindex, nofollow">` y un enlace visible “Abrir propuesta” por si el refresh falla.
- Produce: `docs/robots.txt` con `User-agent: *` y `Disallow: /`.

- [ ] **Step 1: Fijar el slug de H&S**

En `js/catalog.js`, exportar `P.LEGACY_HS_SLUG = 'hs-inmobiliaria-<sufijo>'` con un sufijo generado una vez (4 caracteres) que quedará fijo en el código. La cotización semilla (`defaultQuote`) usa ese slug en `meta.slug` y `meta.client = 'H&S Inmobiliaria'` para que la primera exportación actualice la misma ruta.

En `P.library.migrateQuote` (Task 4), si la cotización migrada tiene `meta.client` vacío o igual a “H&S Inmobiliaria”, asignarle `P.LEGACY_HS_SLUG`; así la cotización que ya existía en el navegador también conserva la URL. Cualquier otro cliente migrado deja `slug: ''` y lo recibe en su primera exportación.

- [ ] **Step 2: Generar la página de H&S y el redirect**

1. Abrir la matriz (`open index.html`), confirmar que la cotización activa es H&S.
2. Pulsar **Exportar cliente** y descargar el paquete.
3. Publicar sin push: `node tools/publicar.mjs ~/Downloads/pandora-<slug>-*.json --dry-run`.
4. Verificar `docs/c/<slug>/index.html` escrito.
5. Escribir `docs/index.html`:
   ```html
   <!DOCTYPE html>
   <html lang="es">
   <head>
   <meta charset="utf-8">
   <meta name="robots" content="noindex, nofollow, noarchive">
   <meta http-equiv="refresh" content="0; url=./c/SLUG/">
   <link rel="canonical" href="./c/SLUG/">
   <title>Propuesta · Pandora Marketing</title>
   </head>
   <body>
   <p><a href="./c/SLUG/">Abrir propuesta</a></p>
   </body>
   </html>
   ```
   reemplazando `SLUG`.
6. Escribir `docs/robots.txt` con `User-agent: *` / `Disallow: /`.
7. Copiar `.nojekyll` a `docs/.nojekyll`. Sin este archivo, Jekyll ignora las carpetas que empiezan con `_` (por ejemplo `docs/c/_e2e*` si quedara alguna) y puede alterar archivos; además acelera el despliegue. Mantener el de la raíz por compatibilidad.
8. Servir localmente y comprobar: `python3 -m http.server 4173 --directory docs`, abrir `http://127.0.0.1:4173/` → redirige a `/c/<slug>/`; la página no tiene inputs ni “Editar”; los videos cargan; el PDF se genera.

- [ ] **Step 3: Cambiar la fuente de GitHub Pages**

Con `gh`:
```bash
gh api -X POST repos/FelipeFLV/cotizacion-pandora/pages/builds \
  -f build_type=legacy 2>/dev/null || true
gh api -X PUT repos/FelipeFLV/cotizacion-pandora/pages \
  -f source[branch]=main -f source[path]=/docs
```
Si `gh` no está autenticado, hacerlo desde la web (Settings → Pages → Source: `main` / `/docs`) y anotarlo en el README.

Verificar: `curl -sI https://felipeflv.github.io/cotizacion-pandora/ | head -3` → 200 (puede tardar unos minutos tras el cambio). Luego la URL sigue mostrando H&S vía redirect.

- [ ] **Step 4: Reescribir el README**

Secciones obligatorias:
1. **Qué es esto** — matriz privada + versiones cliente; enlace a la URL publicada.
2. **Abrir la matriz** — doble clic en `index.html`; no requiere servidor.
3. **Preparar una cotización** — biblioteca, nueva, duplicar, editar, respaldo JSON (y su límite: `localStorage`).
4. **Evidencias** — banco general, modos Servicio/General/Ambas/Ocultar, Modo cliente nuevo; cómo agregar una pieza: copiar el archivo a `docs/assets/media/general/` y usar la ruta `assets/media/general/<archivo>`, o pegar un enlace de YouTube/Vimeo. Aclarar que el selector local solo previsualiza y que `blob:`/`data:video` se bloquean al exportar; las imágenes base64 hasta 1.5 MB.
5. **Publicar** — Exportar cliente → arrastrar el `.json` sobre `Publicar cliente.command` → URL. Republicar: mismo flujo, misma URL, fecha nueva.
6. **Retirar** — botón “Retirar publicación” → paquete → mismo `.command`; la URL da 404; la cotización sigue en la biblioteca.
7. **Historial** — local (10 versiones) + git.
8. **Privacidad y límites** — repo público, URL no adivinable, `noindex`, sin contraseña; qué hacer si se requiere confidencialidad.
9. **Solución de problemas** — push rechazado, Pages tarda, medio faltante, biblioteca vacía tras limpiar el navegador (restaurar respaldo).
10. **Estructura del repo** — tabla de carpetas y qué se publica.

- [ ] **Step 5: Verificar la estructura publicada**

Run:
```bash
git ls-files docs | head -20
ls docs/c
node -e "const fs=require('fs');const h=fs.readFileSync('docs/c/<slug>/index.html','utf8');console.log(/contenteditable|<input|<textarea/.test(h)?'FAIL':'OK')"
```
Expected: `OK`, un directorio por cliente, `docs/app/*` y `docs/assets/*` presentes.

- [ ] **Step 6: Commit (si está autorizado)**

```bash
git add docs js/catalog.js js/store.js README.md .gitignore
git commit -m "feat: publish H&S client page and serve docs"
git push  # solo con autorización explícita
```

Tras el push, esperar el despliegue y verificar que `https://felipeflv.github.io/cotizacion-pandora/` redirige a `/c/<slug>/`.

### Task 10: Verificación final end-to-end

**Files:**
- Modify: `tests/e2e.mjs` (suite completa)
- Create: `tests/README.md` (cómo correr las pruebas)

**Interfaces:**
- Consume todo lo anterior.
- Produce: una corrida única que cubre matriz, cliente, publicación y PDF; sin escrituras en git.

- [ ] **Step 1: Consolidar la suite**

`tests/e2e.mjs` ejecuta en orden y falla al primer error de consola o request:
1. **Matriz (`file://`)**: carga, `body.ready`, logo con `naturalWidth > 0`, sin 404; crear/duplicar/eliminar cotización; edición persistente tras recarga; respaldo e importación; evidencias (modos, “Modo cliente nuevo”, quitar pieza del banco).
2. **Cliente (HTTP local)**: cuatro modos en `docs/c/_e2e-<mode>/`; sin `input/textarea/select/contenteditable`; sin textos de edición; fecha correcta; navegación sin enlaces rotos; `none` sin medios en DOM ni en `window.__PANDORA__`; videos reproducen; lightbox abre/cierra.
3. **Responsive**: en `360`, `390`, `768`, `1024`, `1440` medir `document.documentElement.scrollWidth <= innerWidth + 1` en matriz y cliente (`service` y `general`). Un nombre de cliente de 60 caracteres no debe desbordar portada, docket ni biblioteca.
4. **Exportación**: descarga de paquete válido; bloqueo por `blob:`; en `none` no bloquea; snapshot creado; restaurar versión.
5. **Publicación (`--dry-run`)**: con un paquete fixture, escribe en `tests/tmp/`; colisión de slug aborta; slug inválido aborta; medio inexistente nombra la pieza y la ruta; retiro de un slug ajeno aborta.
6. **PDF**: abrir el cliente con un servicio y modo `service`, click en `[data-action="print"]`, interceptar `page.pdf()` de Playwright si se usa la ruta de impresión; como mínimo verificar que `@media print` oculta `.topbar`, `.pager`, `.lb` y los botones, y que `.print-only` es visible con `page.emulateMedia({ media: 'print' })`.
7. **Limpieza**: `finally` cierra el navegador, mata el server y borra `docs/c/_e2e*` y `tests/tmp`.

- [ ] **Step 2: Correr toda la verificación**

Run:
```bash
node --test tests/core.test.mjs tests/store.test.mjs tests/evidence.test.mjs tests/payload.test.mjs tests/build.test.mjs tests/publicar.test.mjs
node tests/e2e.mjs
node --check js/app.js && node --check js/store.js && node --check js/catalog.js
node --check docs/app/core.js && node --check docs/app/render.js && node --check docs/app/client.js
```
Expected: todos PASS, exit 0.

- [ ] **Step 3: Publicar “Cliente 01” de verdad**

1. En la matriz, crear una cotización con `meta.client = 'Cliente 01'`, un servicio y modo `service`.
2. Exportar el paquete y ejecutar `node tools/publicar.mjs <paquete> --open` (push real, requiere autorización).
3. Confirmar la URL impresa y que `curl -sI <url>` da 200 tras el despliegue.
4. Abrir la URL en Chrome: sin controles de edición, videos y PDF funcionando.
5. Republicar con un cambio de precio: misma URL, fecha nueva, historial con 2 versiones.
6. Retirar con un paquete `pandora-retiro`: la URL da 404 y la cotización sigue en la matriz.

- [ ] **Step 4: Revisión independiente**

Lanzar un subagente `reviewer` con el diff completo y estos focos: fuga de controles de edición al cliente, medios en `none`, numeración/navegación, slug estable, XSS en los datos embebidos (`</script>`), rutas relativas en `docs/c/<slug>/` y `docs/index.html`, y que la matriz no quede servida por Pages.

- [ ] **Step 5: Commit final (si está autorizado)**

```bash
git add tests README.md
git commit -m "test: cover matrix, client, publish and print"
```

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El cliente ve la matriz o un directorio de `docs/` con datos de otros | La matriz está fuera de `/docs`; cada página de cliente embebe solo su cotización; `robots.txt` + `noindex`; slugs aleatorios. No hay índice de clientes. |
| Una pieza `blob:` se publica y se rompe al apagar la Mac | Validación doble (matriz y generador); el mensaje indica copiar a `docs/assets/`. |
| El repo público expone la biblioteca | La biblioteca nunca se escribe en `docs/`; vive en `localStorage`. Los paquetes y respaldos están en `.gitignore`. |
| Cambiar el nombre del cliente rompe la URL | El slug se fija en la primera exportación y no se recalcula. |
| Publicar el slug de otro cliente | El generador compara `pandora-quote-id` y aborta sin `--force`. |
| El historial local se pierde al limpiar el navegador | Respaldo JSON obligatorio en el flujo; README lo recuerda. El historial publicado queda en git. |
| La numeración de secciones queda corrida al ocultar evidencia | La numeración se calcula sobre las secciones efectivamente renderizadas; el E2E lo verifica en los cuatro modos. |

## Criterios de terminado

- [ ] La matriz abre con doble clic y conserva varias cotizaciones tras recargar.
- [ ] Exportar produce un paquete válido y bloquea medios no publicables.
- [ ] El ayudante publica y retira, devuelve la URL y no toca archivos fuera de `docs/c/<slug>/`.
- [ ] La página del cliente no contiene controles de edición y no llama a `localStorage` ni `fetch`.
- [ ] Los cuatro modos de evidencia se reflejan en DOM, navegación, PDF y payload.
- [ ] Republicar conserva la URL y actualiza la fecha; el historial local guarda la versión anterior.
- [ ] GitHub Pages sirve `/docs`; la URL actual sigue mostrando H&S.
- [ ] Todos los tests pasan y el README explica publicar, retirar, respaldar y los límites.
