# Panel privado de cotizaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un panel privado de escritorio, con login, que prepare cotizaciones en Supabase y publique solo la página aprobada y sus imágenes en GitHub Pages, conservando la URL por cliente.

**Architecture:** El panel es una app estática en `docs/admin/` que habla directo con Supabase (auth, base y bucket privado) usando la `anon key` y RLS. Publicar y retirar pasan por Edge Functions que validan la sesión y hacen un commit atómico con la API de GitHub. El HTML del cliente se genera con un renderizador compartido entre Node, el panel y Deno; el diseño, el PDF y la página pública no cambian.

**Tech Stack:** HTML/CSS/JS clásico sin bundler, Supabase (Postgres, Auth, Storage, Edge Functions en Deno), `supabase-js` v2 vendorizado, Node 24 (`node:test`), Playwright con el Chrome instalado, GitHub REST API, GitHub Pages.

**Spec:** `specs/2026-10-28-cms-privado-design.md`

**Ubicación del plan:** `specs/` y no `docs/superpowers/plans/` porque `docs/` es la raíz publicada en GitHub Pages.

## Global Constraints

- Interfaz solo para escritorio: ancho mínimo útil 1024 px. Sin menús ni layouts móviles.
- UI y textos en español; archivos, funciones, tablas y commits en inglés.
- Ningún secreto en el navegador: solo `SUPABASE_URL` y `SUPABASE_ANON_KEY`. `service_role`, token de GitHub y `ALLOWED_EMAIL` viven en secretos de Edge Functions.
- Los borradores, versiones, datos de clientes y medios sin publicar nunca se escriben en `docs/`.
- Solo se publica `docs/c/<slug>/index.html` y `docs/assets/c/<slug>/`.
- La URL de un cliente no cambia al editar precio, condiciones o nombre.
- La plantilla no se publica, no se archiva y no se elimina.
- No se añaden dependencias de runtime al sitio público. `supabase-js` se vendoriza con versión fija.
- No se aloja video propio: piezas nuevas solo YouTube/Vimeo. Los `.mp4` heredados en `docs/assets/media/` siguen válidos.
- El servidor no recomprime imágenes: valida peso y rechaza.
- Node 24 y `node --test`, sin Docker ni base local.
- No hacer `git commit` ni `git push` sin autorización explícita del usuario.
- Mantener la identidad gráfica, las fuentes, el PDF A4 y el `noindex` de las páginas de cliente.
- `specs/` no se sirve en Pages; no mover estos documentos a `docs/`.

## Review Focus

1. **Acceso anónimo:** con la `anon key` y sin sesión, ni la API REST ni el bucket devuelven filas, rutas ni archivos.
2. **Legado intacto:** republicar H&S o Cliente 01 conserva sus videos `.mp4`, sus imágenes y su diseño; no se reescriben rutas a mano.
3. **URL estable:** cambiar el precio de una cotización publicada y republicar mantiene la URL; un cliente nuevo recibe una URL distinta.
4. **Fallo atómico:** si la publicación falla a mitad, la página anterior sigue en pie y no queda un commit parcial ni una imagen huérfana.
5. **Nombres y pesos límite:** nombres con `&`, tildes o muy largos producen un slug válido y no rompen la portada; una imagen de más de 1.5 MB se rechaza con un mensaje claro y no se sube.

---

### Task 1: Proyecto Supabase, configuración y login

**Files:**
- Create: `docs/admin/config.js`
- Create: `docs/admin/vendor/supabase.js`
- Create: `docs/admin/vendor/VERSION`
- Create: `docs/admin/index.html`
- Create: `docs/admin/admin.css`
- Create: `docs/admin/auth.js`
- Create: `tests/admin-config.test.mjs`
- Modify: `.gitignore` (ignorar `.env`, `.env.*` y `supabase/.temp/`)

**Interfaces:**
- Produces: `PANDORA_ADMIN_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_EMAIL }` en `config.js`.
- Produces: `PADMIN.auth.init(config) -> SupabaseClient`, `PADMIN.auth.signIn(email) -> Promise<void>`, `PADMIN.auth.signOut()`, `PADMIN.auth.session() -> Promise<Session|null>`, `PADMIN.auth.onChange(cb)`, `PADMIN.auth.isAllowed(user) -> boolean`.
- Produces: `PADMIN.config.validate(config) -> string[]` (vacío si es válida).
- `docs/admin/index.html` carga `vendor/supabase.js`, `config.js`, `auth.js` y `app.js` en ese orden.

- [ ] **Step 1: Crear el proyecto y los accesos (manual, con el usuario)**

1. Crear un proyecto gratuito en <https://supabase.com> con nombre `pandora-cotizaciones`, región `South America (São Paulo)`.
2. En **Authentication → Providers → Email**: desactivar *Allow new users to sign up* y *Confirm email*; dejar *Email OTP* activo.
3. En **Authentication → URL Configuration**: *Site URL* `https://felipeflv.github.io/cotizacion-pandora/admin/`; *Redirect URLs* esa URL y `http://localhost:4173/docs/admin/`.
4. En **Authentication → Users**: crear el usuario con el correo del editor.
5. Copiar *Project URL* y *anon public key* desde **Project Settings → API**.
6. Instalar la CLI (`brew install supabase/tap/supabase`) y autenticarla (`supabase login`); anotar el *project ref*.

- [ ] **Step 2: Escribir la prueba de configuración**

En `tests/admin-config.test.mjs`, usando `node:test`, `node:assert/strict` y `node:fs`:

```js
test('config is public and complete', () => {
  const cfg = loadConfig();
  assert.deepEqual(PADMIN.config.validate(cfg), []);
  assert.match(cfg.SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.match(cfg.ALLOWED_EMAIL, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
});

test('no service key reaches the browser', () => {
  const files = walk('docs/admin').filter((file) => !file.includes('/vendor/'));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /service_role|SERVICE_ROLE|sb_secret_/, file);
  }
});
```

`loadConfig()` lee `docs/admin/config.js` y ejecuta el archivo en un `vm` con `window = {}`.

- [ ] **Step 3: Ejecutar la prueba y verla fallar**

Run: `node --test tests/admin-config.test.mjs`
Expected: FAIL con `ENOENT` o `PADMIN is not defined`.

- [ ] **Step 4: Crear configuración, cliente vendorizado y login**

- Descargar `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js` a `docs/admin/vendor/supabase.js`; guardar la versión exacta en `docs/admin/vendor/VERSION`.
- `config.js`: exportar `window.PANDORA_ADMIN_CONFIG` con los valores reales y `PADMIN.config.validate` (rechaza URL vacía, anon key que no sea JWT, correo inválido).
- `auth.js`: `init` crea el cliente con `{ auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }`; `signIn` llama `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } })`, que sirve igual en local (`/docs/admin/`) y en producción (`/admin/`); `isAllowed` compara el correo en minúsculas.
- `index.html`: logotipo, título “Cotizaciones”, formulario de correo y botón “Enviar enlace”; estado “Revisa tu correo”; contenedor vacío `#panel` que se muestra con sesión válida. Incluir `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://<ref>.supabase.co; img-src 'self' data: https://<ref>.supabase.co; media-src 'self' https://<ref>.supabase.co; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; style-src 'self' 'unsafe-inline'; script-src 'self';">`.
- `admin.css`: layout de escritorio, misma paleta y tipografía del proyecto; sin `@media` móvil.

- [ ] **Step 5: Ejecutar la prueba y verla pasar**

Run: `node --test tests/admin-config.test.mjs`
Expected: PASS.

- [ ] **Step 6: Verificar el login real**

Run: `python3 -m http.server 4173` y abrir `http://localhost:4173/docs/admin/`.
Expected: el enlace llega al correo, abre el panel y la sesión sobrevive a recargar y a cerrar el navegador.

- [ ] **Step 7: Commit**

```bash
git add docs/admin tests/admin-config.test.mjs .gitignore
git commit -m "feat(admin): add private panel shell with email login"
```

---

### Task 2: Esquema, RLS, storage y verificación de privacidad

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20261028000001_schema.sql`
- Create: `supabase/migrations/20261028000002_rls.sql`
- Create: `supabase/migrations/20261028000003_storage.sql`
- Create: `tools/db-verify.mjs`
- Create: `tests/schema.test.mjs`

**Interfaces:**
- Produces: tablas `quotes`, `quote_versions`, `media`, `bank_items`, `publish_jobs`; bucket privado `drafts`.
- Produces: `node tools/db-verify.mjs` que devuelve `0` si la privacidad se cumple y `1` con el detalle del fallo.

- [ ] **Step 1: Escribir la prueba de esquema**

`tests/schema.test.mjs` lee los tres SQL y afirma que existen:

```js
const schema = read('20261028000001_schema.sql');
for (const table of ['quotes', 'quote_versions', 'media', 'bank_items', 'publish_jobs']) {
  assert.match(schema, new RegExp(`create table public\\.${table}`, 'i'));
}
const rls = read('20261028000002_rls.sql');
for (const table of ['quotes', 'quote_versions', 'media', 'bank_items', 'publish_jobs']) {
  assert.match(rls, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
}
assert.match(rls, /owner_id = auth\.uid\(\)/);
assert.match(read('20261028000003_storage.sql'), /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
```

- [ ] **Step 2: Ejecutar y verla fallar**

Run: `node --test tests/schema.test.mjs`
Expected: FAIL con `ENOENT`.

- [ ] **Step 3: Escribir el esquema**

`20261028000001_schema.sql`:

```sql
create extension if not exists pgcrypto;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  is_template boolean not null default false,
  data jsonb not null,
  published_url text not null default '',
  published_at timestamptz,
  retired_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index quotes_one_template_per_owner
  on public.quotes (owner_id) where is_template;
create index quotes_owner_updated on public.quotes (owner_id, updated_at desc);

alter table public.quotes
  add constraint template_not_archived check (archived_at is null or is_template = false);

create or replace function public.protect_template()
returns trigger language plpgsql as $$
begin
  if old.is_template then
    raise exception 'La plantilla no se elimina';
  end if;
  return old;
end $$;

create trigger quotes_protect_template before delete on public.quotes
for each row execute function public.protect_template();

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  label text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index quote_versions_quote on public.quote_versions (quote_id, created_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 1572864),
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now()
);

create table public.bank_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('video', 'image')),
  title text not null,
  source text not null check (source in ('upload', 'url', 'legacy')),
  media_id uuid references public.media(id) on delete set null,
  url text not null default '',
  service text not null default '',
  created_at timestamptz not null default now()
);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'ok', 'error')),
  url text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger quotes_touch before update on public.quotes
for each row execute function public.touch_updated_at();

create or replace function public.prune_versions()
returns trigger language plpgsql as $$
begin
  delete from public.quote_versions
  where quote_id = new.quote_id
    and id not in (
      select id from public.quote_versions
      where quote_id = new.quote_id
      order by created_at desc
      limit 10
    );
  return new;
end $$;

create trigger quote_versions_prune after insert on public.quote_versions
for each row execute function public.prune_versions();
```

`20261028000002_rls.sql`: para cada tabla, `enable row level security` y cuatro políticas (`select`, `insert`, `update`, `delete`) con `to authenticated` y `using (owner_id = auth.uid())` / `with check (owner_id = auth.uid())`, con nombres `<tabla>_select_own`, `<tabla>_insert_own`, etc. `publish_jobs` solo permite `select`; lo escriben las funciones con service role.

`20261028000003_storage.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('drafts', 'drafts', false)
on conflict (id) do nothing;

create policy drafts_select_own on storage.objects for select to authenticated
using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy drafts_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy drafts_update_own on storage.objects for update to authenticated
using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy drafts_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'drafts' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: Aplicar las migraciones**

Run: `supabase link --project-ref <ref>` y `supabase db push`.
Expected: las cinco tablas y el bucket aparecen en el dashboard.

- [ ] **Step 5: Escribir `tools/db-verify.mjs`**

Requiere `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno. Crea dos usuarios de prueba con contraseña vía `/auth/v1/admin/users`, inicia sesión con `grant_type=password`, inserta una fila con el usuario A, y comprueba:

1. `GET /rest/v1/quotes?select=id` con la `anon key` sin sesión → `[]` o `401`.
2. El usuario B no ve la fila de A.
3. Subir un objeto a `drafts/<uidA>/x.png` con B → `403`.
4. Leer el objeto con la `anon key` → `400/403`.
5. Borrar los usuarios de prueba al terminar.

- [ ] **Step 6: Verificar las políticas**

Run: `SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node tools/db-verify.mjs`
Expected: imprime `RLS OK` y sale con `0`.

- [ ] **Step 7: Ejecutar la prueba de esquema y commit**

Run: `node --test tests/schema.test.mjs`
Expected: PASS.

```bash
git add supabase tools/db-verify.mjs tests/schema.test.mjs
git commit -m "feat(db): add private schema, RLS and storage policies"
```

---

### Task 3: Renderizador compartido, plantilla y paridad con el publicador actual

**Files:**
- Create: `supabase/functions/_shared/render.js`
- Create: `supabase/functions/_shared/template.js`
- Create: `tools/build-template.mjs`
- Modify: `tools/publicar-lib.mjs` (delegar en `_shared/render.js`)
- Create: `tests/render-shared.test.mjs`
- Create: `tests/template-sync.test.mjs`

**Interfaces:**
- Produces: `clientData(quote, general, generatedAt) -> string`
- Produces: `buildClientHtml({ template, pkg, base }) -> string`
- Produces: `resolveSlug(pkg) -> string`
- Produces: `validatePackage(pkg) -> string[]`
- Produces: `slugify(text) -> string`, `uniqueSlug(text, suffix) -> string`
- Produces: `mediaRefs(quote, general) -> string[]` (ids únicos referenciados como `media:<uuid>`)
- Produces: `applyMediaMap(quote, general, map) -> { quote, general }` con copia profunda.
- Produces: `TEMPLATE` (string) exportado por `template.js`.

- [ ] **Step 1: Escribir las pruebas**

`tests/render-shared.test.mjs`:

```js
test('slugify matches the browser implementation', () => {
  for (const name of ['H&S Inmobiliaria', 'Ñandú  Soluciones', 'Cliente 01', '  ']) {
    assert.equal(slugify(name), P.slugify(name), name);
  }
});

test('long names stay within the slug limit', () => {
  const slug = uniqueSlug('Cliente con un nombre larguísimo para una propuesta '.repeat(4), 'a1b2');
  assert.ok(slug.length <= 64);
  assert.match(slug, /^[a-z0-9][a-z0-9-]+$/);
});

test('mediaRefs finds src and poster', () => {
  const quote = { blocks: [{ videos: [{ src: 'media:a', poster: 'media:b' }], images: [{ src: 'media:c' }] }] };
  const general = { videos: [{ src: 'media:d' }], images: [] };
  assert.deepEqual(mediaRefs(quote, general).sort(), ['a', 'b', 'c', 'd']);
});

test('applyMediaMap rewrites only media refs', () => {
  const quote = { blocks: [{ videos: [{ src: 'media:a', poster: 'assets/x.jpg' }], images: [] }] };
  const out = applyMediaMap(quote, { videos: [], images: [] }, { a: 'assets/c/x/a.webp' });
  assert.equal(out.quote.blocks[0].videos[0].src, 'assets/c/x/a.webp');
  assert.equal(out.quote.blocks[0].videos[0].poster, 'assets/x.jpg');
});
```

`tests/template-sync.test.mjs`: `TEMPLATE` es idéntico byte a byte a `tools/cliente.template.html` y contiene los siete tokens `{{TITLE}}`, `{{DESCRIPTION}}`, `{{QUOTE_ID}}`, `{{GENERATED_AT}}`, `{{DATE_ISO}}`, `{{DATE_LABEL}}`, `{{BASE}}`, `{{DATA}}`.

- [ ] **Step 2: Ejecutar y verlas fallar**

Run: `node --test tests/render-shared.test.mjs tests/template-sync.test.mjs`
Expected: FAIL con `Cannot find module`.

- [ ] **Step 3: Extraer el renderizador**

Mover a `_shared/render.js` las funciones `clientData`, `buildClientHtml`, `resolveSlug`, `validatePackage` y `escapeHtml`/`fillTokens` tal como están hoy en `tools/publicar-lib.mjs`. Añadir `slugify`/`uniqueSlug` copiados de `docs/app/core.js` y las utilidades de medios. El módulo no importa nada de Node: solo JavaScript estándar, para que Deno lo ejecute.

`tools/publicar-lib.mjs` conserva `prepareClient`, `retireClient`, `readSiteBase`, `pageUrl` y `existingQuoteId`, e importa del módulo compartido. No duplica lógica.

- [ ] **Step 4: Generar la plantilla**

`tools/build-template.mjs` lee `tools/cliente.template.html` y escribe `supabase/functions/_shared/template.js`:

```js
export const TEMPLATE = `...contenido escapado en backticks...`;
```

Escapa `` ` ``, `\` y `${`.

- [ ] **Step 5: Verificar paridad**

Run: `npm test`
Expected: las 42 unitarias y 9 E2E siguen en verde; las dos nuevas pruebas también.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared tools/build-template.mjs tools/publicar-lib.mjs tests/render-shared.test.mjs tests/template-sync.test.mjs
git commit -m "refactor(publish): share client renderer across node and deno"
```

---

### Task 4: Capa de datos, importación de la biblioteca y plantilla

**Files:**
- Create: `docs/admin/model.js`
- Create: `docs/admin/api.js`
- Create: `tests/admin-model.test.mjs`
- Modify: `docs/admin/index.html` (cargar `model.js` y `api.js`)

**Interfaces:**
- Produces: `PADMIN.model.fromBackup(json, ownerId) -> { quotes, bank }`
- Produces: `PADMIN.model.newClientData(template) -> quote`
- Produces: `PADMIN.model.rowToQuote(row) -> quote`, `PADMIN.model.quoteToPatch(quote) -> object`
- Produces: `PADMIN.model.versionSummary(entry) -> { at, label, published }`
- Produces: `PADMIN.api.init(client)`
- Produces: `PADMIN.api.listQuotes() -> Promise<Row[]>`
- Produces: `PADMIN.api.createQuote({ data, isTemplate }) -> Promise<Row>`
- Produces: `PADMIN.api.saveQuote(id, quote) -> Promise<Row>`
- Produces: `PADMIN.api.archiveQuote(id)`, `PADMIN.api.setTemplate(id)`, `PADMIN.api.duplicateQuote(id)`, `PADMIN.api.newClientFrom(id)`
- Produces: `PADMIN.api.listVersions(quoteId)`, `PADMIN.api.createVersion(quoteId, label, published)`, `PADMIN.api.restoreVersion(versionId)`
- Produces: `PADMIN.api.getMedia(ids) -> Promise<Row[]>`, `PADMIN.api.signedUrl(path) -> Promise<string>`
- Produces: `PADMIN.api.listBankItems()`, `PADMIN.api.addBankItem(item)`, `PADMIN.api.removeBankItem(id)`

- [ ] **Step 1: Escribir las pruebas de importación**

`tests/admin-model.test.mjs` con un respaldo de dos cotizaciones (una con `publishedUrl`, otra sin) y un banco de dos piezas:

```js
test('backup maps to rows without losing identity', () => {
  const out = PADMIN.model.fromBackup(backup(), 'user-1');
  assert.equal(out.quotes.length, 2);
  assert.equal(out.quotes[0].status, 'published');
  assert.equal(out.quotes[0].slug, 'h-s-inmobiliaria-7k2m');
  assert.equal(out.quotes[0].published_url, 'https://example.test/c/h-s/');
  assert.equal(out.quotes[1].status, 'draft');
  assert.equal(out.bank.length, 2);
});

test('a new client clears identity but keeps content', () => {
  const client = PADMIN.model.newClientData(templateQuote());
  assert.equal(client.meta.client, 'Cliente sin nombre');
  assert.equal(client.meta.slug, '');
  assert.equal(client.meta.quoteNo, '');
  assert.equal(client.meta.isDraft, false);
  assert.equal(client.blocks.length, 1);
  assert.equal(client.evidence.mode, 'service');
});

test('an unknown backup version is rejected', () => {
  assert.throws(() => PADMIN.model.fromBackup({ version: 9 }, 'user-1'), /versión/i);
});
```

- [ ] **Step 2: Ejecutar y verla fallar**

Run: `node --test tests/admin-model.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `model.js`**

Reglas de importación: `version === 1`; cada entrada exige `quote.meta`, `quote.blocks` no vacío y `quote.id`. `status` = `retired` si `meta.retiredAt`, si no `published` si `meta.publishedUrl`, si no `draft`. `slug` desde `meta.slug`. `data` guarda la cotización tal cual, sin `isDraft` (esa marca es local de la matriz y no aplica). Las versiones del respaldo se insertan como `quote_versions` con `published: true`.

`newClientData(template)` clona, limpia `meta.client`, `meta.quoteNo`, `meta.slug`, `meta.generatedAt`, `meta.publishedUrl`, `meta.publishedAt`, `meta.retiredAt`, `meta.retireRequestedAt`, `meta.isDraft`; fija `meta.date` con `P.todayISO()`; deja `blocks`, `bank`, `evidence` y `conditions`.

- [ ] **Step 4: Implementar `api.js`**

Envoltorio delgado sobre `supabase.from(...)`. Siempre incluye `owner_id` en inserts; nunca lo envía en updates. `saveQuote` escribe `data`, `slug` y `status`. `newClientFrom` lee la plantilla y crea una fila nueva. `duplicateQuote` copia con slug nulo y estado `draft`. `setTemplate` ejecuta una transacción lógica: quita la marca a la actual y marca la nueva; si falla, revierte en memoria y avisa.

- [ ] **Step 5: Verificar y commit**

Run: `node --test tests/admin-model.test.mjs`
Expected: PASS.

```bash
git add docs/admin/model.js docs/admin/api.js docs/admin/index.html tests/admin-model.test.mjs
git commit -m "feat(admin): add data layer and library import"
```

---

### Task 5: Panel, barra lateral y estados

**Files:**
- Create: `docs/admin/app.js`
- Create: `docs/admin/library.js`
- Modify: `docs/admin/admin.css`
- Create: `tests/admin-list.test.mjs`

**Interfaces:**
- Produces: `PADMIN.library.render({ quotes, activeId, filter, query }) -> string` (HTML seguro).
- Produces: `PADMIN.library.state(row) -> 'template' | 'published' | 'retired' | 'draft' | 'pending'`.
- Consumes: `PADMIN.api.listQuotes`, `PADMIN.api.archiveQuote`, `PADMIN.api.setTemplate`.

- [ ] **Step 1: Escribir la prueba de estados**

`tests/admin-list.test.mjs`:

```js
test('row state', () => {
  assert.equal(state({ is_template: true }), 'template');
  assert.equal(state({ status: 'published', retired_at: null }), 'published');
  assert.equal(state({ status: 'retired' }), 'retired');
  assert.equal(state({ status: 'draft' }), 'draft');
});

test('a template has no publish or archive actions', () => {
  const html = render({ quotes: [{ id: 'q1', is_template: true, data: quote(), status: 'draft' }], activeId: 'q1' });
  assert.doesNotMatch(html, /data-action="publish"/);
  assert.doesNotMatch(html, /data-action="archive"/);
  assert.match(html, /data-action="new-client"/);
});
```

- [ ] **Step 2: Ejecutar y verla fallar**

Run: `node --test tests/admin-list.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar la barra lateral**

- Encabezado con nombre del editor y **Salir**.
- Buscador por cliente y filtros: Todas, Borradores, Publicadas, Retiradas.
- Cada fila: nombre, servicios (desde `data.blocks[].title`), fecha, estado y URL (solo publicadas).
- Acciones por fila: abrir, duplicar, usar como plantilla, archivar, historial.
- En la plantilla: solo **Nuevo cliente**.
- **Importar respaldo** siempre disponible en el menú superior; nunca reemplaza en silencio: pide confirmación y muestra cuántas cotizaciones va a añadir.
- Estado vacío: “Importa tu biblioteca o crea la plantilla desde una cotización existente.”

- [ ] **Step 4: Integrar el arranque en `app.js`**

Flujo: sesión → `api.listQuotes()` → render → seleccionar la primera o la recordada en `localStorage`. Al cambiar de cotización, pedir confirmación si hay cambios sin guardar. Sin sesión, volver al login.

- [ ] **Step 5: Verificar la lista en el navegador**

Run: `python3 -m http.server 4173` y abrir `docs/admin/` con sesión.
Expected: se ven las cotizaciones importadas, los filtros funcionan y una plantilla no ofrece publicar ni archivar.

- [ ] **Step 6: Commit**

```bash
git add docs/admin/app.js docs/admin/library.js docs/admin/admin.css tests/admin-list.test.mjs
git commit -m "feat(admin): add desktop sidebar and quote states"
```

---

### Task 6: Editor por secciones y autoguardado

**Files:**
- Create: `docs/admin/editor.js`
- Create: `docs/admin/form.js`
- Create: `docs/admin/editor-model.js`
- Create: `tests/admin-editor.test.mjs`
- Modify: `docs/admin/app.js`, `docs/admin/admin.css`

**Interfaces:**
- Produces: `PADMIN.editor.mount(el, { quote, onChange })`, `PADMIN.editor.refresh(quote)`
- Produces: `PADMIN.form.text({ path, label, value, hint? })`, `PADMIN.form.textarea(...)`, `PADMIN.form.list({ path, label, items })`, `PADMIN.form.money(...)` → HTML con `data-field="<path>"`.
- Produces: `PADMIN.editorModel.setPath(quote, path, value) -> quote` (inmutable), `addBlock(quote)`, `removeBlock(quote, index)`, `moveBlock(quote, from, to)`, `addItem(block)`, `removeItem(block, index)`, `paymentTotal(quote)`.
- Consumes: `P.totals(quote)` del núcleo para subtotal, IGV y total.

- [ ] **Step 1: Escribir las pruebas del modelo del editor**

```js
test('setPath does not mutate the original', () => {
  const q = quote();
  const next = setPath(q, 'meta.client', 'Nuevo');
  assert.equal(q.meta.client, 'H&S Inmobiliaria');
  assert.equal(next.meta.client, 'Nuevo');
});

test('blocks can be added, moved and removed', () => {
  let q = quote();
  q = addBlock(q);
  assert.equal(q.blocks.length, 2);
  q = moveBlock(q, 1, 0);
  assert.equal(q.blocks[0].uid, 'b2');
  q = removeBlock(q, 0);
  assert.equal(q.blocks.length, 1);
  assert.equal(removeBlock(q, 0).blocks.length, 1, 'siempre queda un bloque');
});

test('payments must total 100', () => {
  const q = quote();
  q.meta.payments = [{ pct: 60 }, { pct: 30 }];
  assert.equal(paymentTotal(q), 90);
  assert.equal(paymentValid(q), false);
});
```

- [ ] **Step 2: Ejecutar y verlas fallar**

Run: `node --test tests/admin-editor.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar los campos y el editor**

Secciones y campos exactos:

- **Cliente:** `meta.client`, `meta.quoteNo`, `meta.date` (date), `meta.duration`, `meta.validity`, `meta.lede`, `meta.closing`, `meta.taxEnabled` (checkbox), `meta.taxRate` (número).
- **Servicios:** por bloque `title`, `tagline`, `duration`, `deliverables` (una por línea), `considerations` (una por línea), `process` (una por línea), `items` (concepto + monto). Botones subir, bajar, duplicar bloque y eliminar (mínimo uno).
- **Evidencias:** pestañas Video/Imagen por bloque; se completan en la Task 8.
- **Inversión:** tabla de líneas con concepto y monto; subtotal, IGV y total calculados; pagos con etiqueta y porcentaje; aviso si no suman 100.
- **Condiciones:** lista editable de `meta.conditions`; banco con `holder`, `account`, `cci`, `detractions`, `bankName`.
- **Publicación:** se completa en la Task 10.

El editor no usa `contenteditable`: todo son `input`, `textarea` y `select` con `data-field`. Un solo listener `input` delegado actualiza el modelo, marca “Guardando…” y programa el guardado con 800 ms de debounce. Al guardar: “Guardado · hh:mm”. Si falla: “Error al guardar” con botón **Reintentar**.

- [ ] **Step 4: Verificar el editor con una cotización real**

Run: `python3 -m http.server 4173`, abrir Cliente 01, cambiar el precio de una línea y recargar.
Expected: el total se recalcula, el cambio persiste en Supabase y no se crea ninguna versión.

- [ ] **Step 5: Commit**

```bash
git add docs/admin/editor.js docs/admin/form.js docs/admin/editor-model.js docs/admin/app.js docs/admin/admin.css tests/admin-editor.test.mjs
git commit -m "feat(admin): add section editor with autosave"
```

---

### Task 7: Vista previa y PDF

**Files:**
- Create: `docs/admin/preview.html`
- Create: `docs/admin/preview.js`
- Create: `docs/admin/model-media.js`
- Create: `tests/admin-preview.test.mjs`
- Modify: `docs/admin/app.js`, `docs/admin/admin.css`

**Interfaces:**
- Produces: `PADMIN.modelMedia.resolve(quote, general, signedMap) -> { quote, general }`. Implementa la sustitución en el navegador; la paridad con `applyMediaMap` del servidor se cubre en `tests/admin-preview.test.mjs` con la misma tabla de casos.
- Produces: `PADMIN.preview.open({ quote, general, signedMap })`, `PADMIN.preview.close()`, `PADMIN.preview.print()`.
- `preview.html` escucha `message` con `{ type: 'pandora-preview', quote, general }`, fija `window.P = { assetBase: '../' }` y llama `P.render.all(quote, { readonly: true, view: 'client', evidenceMode, general })`.

- [ ] **Step 1: Escribir la prueba de resolución de medios**

```js
test('media refs become signed urls for preview', () => {
  const quote = { blocks: [{ videos: [{ src: 'media:a' }], images: [{ src: 'media:b' }] }] };
  const out = resolve(quote, { videos: [], images: [] }, { a: 'https://signed/a', b: 'https://signed/b' });
  assert.equal(out.quote.blocks[0].videos[0].src, 'https://signed/a');
  assert.equal(out.quote.blocks[0].images[0].src, 'https://signed/b');
});

test('legacy assets and links are untouched', () => {
  const quote = { blocks: [{ videos: [{ src: 'assets/media/x.mp4' }], images: [{ src: 'https://x/y.jpg' }] }] };
  const out = resolve(quote, { videos: [], images: [] }, {});
  assert.equal(out.quote.blocks[0].videos[0].src, 'assets/media/x.mp4');
  assert.equal(out.quote.blocks[0].images[0].src, 'https://x/y.jpg');
});
```

- [ ] **Step 2: Ejecutar y verla fallar**

Run: `node --test tests/admin-preview.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar la vista previa**

- `preview.html` carga `../assets/fonts.css`, `../app/app.css`, `../app/print.css`, `../app/core.js`, `../app/render.js` y `preview.js`.
- El panel abre un panel lateral a 420 px o un modal a pantalla completa, con botones **Imprimir / PDF** y **Cerrar**.
- **PDF** llama `iframe.contentWindow.print()`; `print.css` ya oculta la interfaz.
- El panel obtiene las filas con `api.getMedia(ids)`, pide `api.signedUrl(path)` por cada una y resuelve `media:<uuid>` antes de enviar; los medios recién subidos usan la URL firmada obtenida al subir.
- La vista previa no guarda ni permite editar.

- [ ] **Step 4: Verificar visualmente**

Run: abrir Cliente 01 en el panel y comparar la vista previa con la página publicada.
Expected: mismo diseño, mismos textos, mismos videos; el PDF cabe en A4.

- [ ] **Step 5: Commit**

```bash
git add docs/admin/preview.html docs/admin/preview.js docs/admin/model-media.js docs/admin/app.js docs/admin/admin.css tests/admin-preview.test.mjs
git commit -m "feat(admin): add client preview and print"
```

---

### Task 8: Evidencias, compresión y banco

**Files:**
- Create: `docs/admin/media.js`
- Create: `docs/admin/evidence.js`
- Create: `tests/admin-media.test.mjs`
- Modify: `docs/admin/api.js`, `docs/admin/editor.js`, `docs/admin/app.js`, `docs/admin/admin.css`

**Interfaces:**
- Produces: `PADMIN.media.fit(w, h, max) -> { width, height }`
- Produces: `PADMIN.media.compress(file) -> Promise<{ blob, width, height, mime }>` (máx. 1800 px de lado mayor, calidad 0.85, WebP; si el navegador no soporta WebP, JPEG).
- Produces: `PADMIN.media.upload(file) -> Promise<{ id, path, src: 'media:<id>' }>`
- Produces: `PADMIN.media.videoError(url) -> string` (vacío si es YouTube/Vimeo o legado válido).
- Produces: `PADMIN.media.toBankItem(media, kind, title, service) -> object`
- Produces: `PADMIN.evidence.render({ quote, bank, onPick })`.

- [ ] **Step 1: Escribir las pruebas puras**

```js
test('fit keeps the aspect ratio under the cap', () => {
  assert.deepEqual(fit(4000, 3000, 1800), { width: 1800, height: 1350 });
  assert.deepEqual(fit(800, 600, 1800), { width: 800, height: 600 });
});

test('video links', () => {
  assert.equal(videoError('https://youtu.be/abc123'), '');
  assert.equal(videoError('https://vimeo.com/123456'), '');
  assert.equal(videoError('https://example.com/x.mp4'), 'Usa un enlace de YouTube o Vimeo.');
  assert.equal(videoError(''), 'Pega un enlace de YouTube o Vimeo.');
});

test('legacy local video stays valid', () => {
  assert.equal(videoError('assets/media/metaads/1.mp4'), '');
});

test('uploads over 1.5 MB are rejected', () => {
  assert.throws(() => assertUpload(1572865), /1.5 MB/);
});
```

- [ ] **Step 2: Ejecutar y verlas fallar**

Run: `node --test tests/admin-media.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar compresión y subida**

- Validar tipo `image/jpeg|png|webp` y tamaño original ≤ 15 MB.
- Redimensionar con `createImageBitmap` + `canvas.toBlob`.
- Subir a `drafts/<uid>/<uuid>.<ext>`; insertar fila en `media` con `bytes`, `width`, `height`.
- Si el blob final supera 1.5 MB, bajar calidad a 0.7 y reintentar una vez; si sigue, rechazar con “La imagen sigue pesando más de 1.5 MB. Recórtala o usa otra.”
- Arrastrar y soltar sobre la zona de evidencias, con clic como alternativa.

- [ ] **Step 4: Implementar el gestor de evidencias**

- Pestañas **Video** e **Imagen** por bloque y para el banco general.
- Video: campo de enlace + **Añadir**; se valida el dominio; portada opcional (subida o miniatura de YouTube).
- Imagen: subida o enlace.
- Cada pieza: título, servicio, botón quitar y vista previa en miniatura.
- **Banco general**: lista de piezas reutilizables; se marcan por cotización con `evidence.generalIds`; modos Servicio, General, Ambas, Ocultar.
- El modo de evidencias se guarda en `quote.evidence.mode` y se refleja en la vista previa.

- [ ] **Step 5: Verificar con archivos reales**

Run: subir una foto >2 MB y un video de YouTube; previsualizar.
Expected: la foto queda bajo 1.5 MB y se ve; el video se incrusta; un `.mp4` suelto muestra el error y no se guarda.

- [ ] **Step 6: Commit**

```bash
git add docs/admin/media.js docs/admin/evidence.js docs/admin/api.js docs/admin/editor.js docs/admin/app.js docs/admin/admin.css tests/admin-media.test.mjs
git commit -m "feat(admin): add image upload, compression and evidence bank"
```

---

### Task 9: Función de publicación con commit atómico

**Files:**
- Create: `supabase/functions/publish/index.ts`
- Create: `supabase/functions/_shared/github.js`
- Create: `supabase/functions/_shared/plan.js`
- Create: `supabase/functions/_shared/http.js`
- Create: `tests/github.test.mjs`
- Create: `tests/publish-plan.test.mjs`
- Create: `supabase/functions/publish/README.md` (secretos y despliegue)

**Interfaces:**
- Produces: `createGithub({ token, repo, branch, fetchImpl })` → `{ listPaths(prefix) -> Promise<string[]>, commit({ message, files, deletions }) -> { sha, url } }`, con `files: [{ path, content, encoding: 'utf8'|'base64' }]`.
- Produces: `planPublish({ quote, general, slug, siteBase, generatedAt, template, assetPaths, existingPaths, isTemplate }) -> { html, files, deletions, url }`.
- Produces: `json(status, body, origin)`, `cors(origin)`, `requireUser(req, supabase)`.
- Endpoint: `POST /functions/v1/publish` con `{ quoteId }`.
- Endpoint: `POST /functions/v1/retire` con `{ quoteId }` (Task 10).

- [ ] **Step 1: Escribir las pruebas del cliente de GitHub**

Con un `fetchImpl` falso que registra llamadas:

```js
test('commit creates blobs, tree, commit and moves the ref', async () => {
  const gh = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: fakeGithub() });
  const out = await gh.commit({
    message: 'Publicar cliente',
    files: [{ path: 'docs/c/x/index.html', content: '<html>', encoding: 'utf8' }],
    deletions: []
  });
  assert.equal(out.sha, 'commit-1');
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.path), [
    'GET /repos/o/r/git/ref/heads/main',
    'GET /repos/o/r/git/commits/base',
    'GET /repos/o/r/git/trees/base',
    'POST /repos/o/r/git/blobs',
    'POST /repos/o/r/git/trees',
    'POST /repos/o/r/git/commits',
    'PATCH /repos/o/r/git/refs/heads/main'
  ]);
});

test('a failed tree does not move the ref', async () => {
  const gh = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: fakeGithub({ failAt: 'tree' }) });
  await assert.rejects(gh.commit({ message: 'x', files: [], deletions: [] }));
  assert.equal(calls.some((c) => c.method === 'PATCH'), false);
});
```

- [ ] **Step 2: Escribir las pruebas del plan**

```js
test('media refs become public asset paths', () => {
  const plan = planPublish({ quote: withMedia(), general: empty(), slug: 'cliente-01-9k4d', siteBase: SITE, generatedAt: '2026-10-28T12:00:00.000Z', template: TEMPLATE, assetPaths: { a: 'a.webp' } });
  assert.match(plan.html, /assets\/c\/cliente-01-9k4d\/a\.webp/);
  assert.doesNotMatch(plan.html, /media:a/);
  assert.equal(plan.url, `${SITE}/c/cliente-01-9k4d/`);
  assert.deepEqual(plan.files.map((f) => f.path).sort(), ['docs/assets/c/cliente-01-9k4d/a.webp', 'docs/c/cliente-01-9k4d/index.html']);
});

test('legacy assets are kept and nothing outside the slug is deleted', () => {
  const plan = planPublish({ quote: withLegacy(), general: empty(), slug: 'h-s-inmobiliaria-7k2m', siteBase: SITE, generatedAt: '2026-10-28T12:00:00.000Z', template: TEMPLATE, assetPaths: {} , existingPaths: ['docs/assets/media/metaads/1.mp4', 'docs/assets/c/h-s-inmobiliaria-7k2m/old.webp'] });
  assert.match(plan.html, /assets\/media\/metaads\/1\.mp4/);
  assert.deepEqual(plan.deletions, ['docs/assets/c/h-s-inmobiliaria-7k2m/old.webp']);
});

test('a template cannot be planned', () => {
  assert.throws(() => planPublish({ quote: { meta: { client: 'X' }, blocks: [] }, template: TEMPLATE, isTemplate: true }), /plantilla/i);
});
```

- [ ] **Step 3: Ejecutar y verlas fallar**

Run: `node --test tests/github.test.mjs tests/publish-plan.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implementar `github.js`**

Secuencia: leer `ref/heads/<branch>` → `git/commits/<sha>` → `git/trees/<tree>`; crear blobs; crear árbol con `base_tree` y entradas `{ path, mode: '100644', type: 'blob', sha }`, más entradas con `sha: null` para borrados; crear commit con el árbol nuevo; `PATCH refs/heads/<branch>` con `force: false`. Cualquier fallo antes del `PATCH` deja la rama intacta. Timeout de 8 s por llamada; un reintento solo en `5xx`.

`listPaths(prefix)` recorre `git/trees/<sha>?recursive=1` y devuelve solo los `blob` cuya ruta empieza por `prefix`; lo usan `publish` (para borrar imágenes viejas) y `retire`.

- [ ] **Step 5: Implementar `plan.js`**

- Rechaza plantillas, cliente vacío, bloques vacíos y slug inválido.
- Aplica `applyMediaMap` con `assets/c/<slug>/<mediaId>.<ext>`.
- Valida que cada `media:<id>` tenga archivo en `assetPaths`; si falta, error con el título de la pieza.
- Conserva rutas `assets/...` existentes.
- Rechaza `blob:`, `file:`, `javascript:`, `vbscript:` y `data:`.
- Rechaza video nuevo que no sea YouTube/Vimeo; acepta `assets/**.mp4` heredado.
- Genera HTML con `buildClientHtml` y `template`.
- Calcula `deletions` solo bajo `docs/assets/c/<slug>/`, comparando `existingPaths`.
- Devuelve `files` con HTML (`utf8`) y cada imagen (`base64`).

- [ ] **Step 6: Implementar `index.ts`**

1. CORS solo para `ALLOWED_ORIGIN`.
2. `requireUser`: `Authorization: Bearer` → `auth.getUser`; correo igual a `ALLOWED_EMAIL`.
3. Cargar la cotización y verificar `owner_id`.
4. Crear `publish_jobs` en `running`.
5. Resolver slug: si la fila no tiene, `slugify(client) + '-' + random4()`; hasta 5 intentos ante colisión.
6. Descargar de `drafts` los medios referenciados y convertir a base64.
7. `existingPaths = await github.listPaths('docs/assets/c/<slug>/')`; `planPublish`; `github.commit`.
8. Actualizar `quotes` (`status='published'`, `slug`, `published_url`, `published_at`), insertar versión `published: true`, marcar job `ok`.
9. Responder `{ url, commit }`. En error: job `error` con mensaje saneado, sin volcar datos.

- [ ] **Step 7: Verificar con un repositorio de prueba**

Run: `supabase functions deploy publish` (con verificación de JWT activa) y ejecutar contra un repo de prueba (`GITHUB_REPO` apuntando a un fork vacío).
Expected: se crean los archivos, el commit aparece en GitHub y la URL se devuelve; con un fallo simulado, la rama no se mueve.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/publish supabase/functions/_shared tests/github.test.mjs tests/publish-plan.test.mjs
git commit -m "feat(publish): add atomic github publisher edge function"
```

---

### Task 10: Retiro, historial y bloque de publicación

**Files:**
- Create: `supabase/functions/retire/index.ts`
- Create: `supabase/functions/_shared/retire-plan.js`
- Create: `docs/admin/publish.js`
- Create: `docs/admin/history.js`
- Create: `tests/retire-plan.test.mjs`

**Interfaces:**
- Produces: `planRetire({ slug, siteBase, existingPaths }) -> { deletions, url }` (borra `docs/c/<slug>/` y `docs/assets/c/<slug>/`).
- Produces: `PADMIN.publish.quote(id)`, `PADMIN.publish.retire(id)`, `PADMIN.publish.copyUrl(url)`.
- Produces: `PADMIN.history.render({ versions, onRestore })`.

- [ ] **Step 1: Escribir la prueba del retiro**

```js
test('retire removes only the slug folder', () => {
  const plan = planRetire({
    slug: 'cliente-01-9k4d',
    siteBase: SITE,
    existingPaths: [
      'docs/c/cliente-01-9k4d/index.html',
      'docs/assets/c/cliente-01-9k4d/a.webp',
      'docs/assets/c/otro/a.webp',
      'docs/assets/media/metaads/1.mp4'
    ]
  });
  assert.deepEqual(plan.deletions.sort(), ['docs/assets/c/cliente-01-9k4d/a.webp', 'docs/c/cliente-01-9k4d/index.html']);
  assert.equal(plan.url, 'https://felipeflv.github.io/cotizacion-pandora/c/cliente-01-9k4d/');
});
```

- [ ] **Step 2: Ejecutar y verla fallar**

Run: `node --test tests/retire-plan.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar la función `retire`**

Misma autenticación y CORS que `publish`. Verifica que el `quote_id` de la página coincida con la fila antes de borrar. Un commit con `sha: null` para cada ruta. Actualiza `status='retired'`, `retired_at`; conserva el bucket privado. Devuelve `{ ok: true }`.

- [ ] **Step 4: Implementar el bloque de publicación**

- Estado, URL con **Copiar** y **Abrir**.
- **Publicar** (deshabilitado en plantilla o sin cliente): confirmación si ya está publicada; barra de progreso indeterminada; al terminar, “Publicado. GitHub Pages puede tardar un minuto.”
- **Retirar** con confirmación explícita que explique que la URL dejará de existir.
- **PDF** y **Historial**.
- Errores: mensaje del job con **Reintentar**.

- [ ] **Step 5: Implementar el historial**

Lista de versiones (fecha, etiqueta, publicada) con **Restaurar**. Restaurar pide confirmación, crea una versión del estado actual antes de reemplazar, y recarga el editor. El historial nunca se genera por autoguardado.

- [ ] **Step 6: Verificar el ciclo completo**

Run: publicar un cliente de prueba, cambiar el precio, republicar, abrir la URL, retirar.
Expected: misma URL en ambas publicaciones; el retiro devuelve 404 tras el despliegue; el historial muestra las dos versiones.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/retire supabase/functions/_shared/retire-plan.js docs/admin/publish.js docs/admin/history.js tests/retire-plan.test.mjs
git commit -m "feat(admin): add publish, retire and version history"
```

---

### Task 11: Migración de H&S y Cliente 01 con paridad

**Files:**
- Create: `specs/2026-10-28-migracion-registro.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PADMIN.model.fromBackup`, panel y funciones ya desplegadas.

- [ ] **Step 1: Congelar y respaldar**

1. Exportar el respaldo JSON desde la matriz actual.
2. Guardar copia de `docs/c/h-s-inmobiliaria-7k2m/index.html`, `docs/c/cliente-01-9k4d/index.html` y capturas de ambas.
3. No editar la matriz durante la migración.

- [ ] **Step 2: Importar**

Run: panel → **Importar respaldo**.
Expected: dos cotizaciones, H&S y Cliente 01, en estado `Publicada`, con sus slugs y URLs; el banco con sus 10 piezas.

- [ ] **Step 3: Crear la plantilla**

Elegir una cotización sin publicar (o duplicar Cliente 01) y marcarla como plantilla. Verificar que no se puede publicar ni archivar.

- [ ] **Step 4: Verificar paridad sin republicar**

Comparar en el panel la vista previa de H&S y Cliente 01 contra las páginas publicadas: textos, precios, totales, condiciones, banco, videos `.mp4` y orden de secciones. Anotar diferencias en `specs/2026-10-28-migracion-registro.md`.

- [ ] **Step 5: Republicar solo un clon de prueba**

Duplicar Cliente 01 como cliente de prueba, publicarlo, cambiar el precio y republicar. Confirmar URL estable, historial y PDF. Retirarlo y confirmar 404.

- [ ] **Step 6: No tocar las páginas reales todavía**

H&S y Cliente 01 quedan publicadas con su HTML actual; el panel solo las tiene como registros. Republicar una página real es una decisión aparte del usuario y se hace cuando él edite esa cotización, no como parte de la migración. Dejarlo escrito en el registro de migración.

- [ ] **Step 7: Documentar y commit**

`README.md`: sección “Panel privado” con URL, login, publicación y límites. `specs/2026-10-28-migracion-registro.md`: qué se importó, qué se comparó y qué quedó pendiente.

```bash
git add README.md specs/2026-10-28-migracion-registro.md
git commit -m "docs: document private panel and migration record"
```

---

### Task 12: Cierre, pruebas y aceptación

**Files:**
- Modify: `README.md`, `package.json` (script `test:admin`)
- Create: `tests/e2e-admin.mjs`
- Create: `tests/acceptance.md`

- [ ] **Step 1: Correr toda la suite**

Run: `npm test`
Expected: 42 unitarias + 9 E2E + las nuevas pruebas en verde.

- [ ] **Step 2: Añadir el E2E del panel (gated)**

`tests/e2e-admin.mjs` reutiliza el patrón de `tests/e2e.mjs` (Chrome instalado, sin dependencias nuevas). Requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_TEST_EMAIL`; si faltan, imprime `E2E panel: omitido` y sale con `0`.

Flujo: generar enlace con `auth.admin.generateLink`, abrir sesión, importar un respaldo fixture, crear cliente desde la plantilla, editar precio, subir una imagen pequeña, previsualizar, publicar en un repo de prueba, republicar y comprobar que la URL no cambió, abrir el historial, retirar y comprobar 404. Si `GITHUB_TEST_REPO` no está definido, el tramo de publicación se omite.

- [ ] **Step 3: Recorrer la aceptación**

`tests/acceptance.md` con casillas:

- [ ] Desde una segunda computadora, con login, se ve la misma biblioteca.
- [ ] Sin sesión, la API y el bucket no devuelven nada.
- [ ] Un cliente nuevo desde la plantilla recibe una URL nueva.
- [ ] Cambiar el precio de un cliente publicado conserva la URL.
- [ ] Una imagen subida y un video de YouTube se ven en la página publicada.
- [ ] Un borrador y sus imágenes no existen en el repositorio público.
- [ ] El PDF coincide con la página y cabe en A4.
- [ ] H&S y Cliente 01 conservan URL, diseño y videos.
- [ ] Un fallo de publicación no altera la página anterior y se puede reintentar.
- [ ] La página sigue visible con la Mac apagada.
- [ ] Retirar una publicación devuelve 404 y conserva el historial.

- [ ] **Step 4: Revisar privacidad del repo**

Run: `git ls-files docs/ | grep -E 'admin/(config|app)'` y `git grep -n 'service_role\|sb_secret_\|ghp_'`.
Expected: solo la configuración pública; ningún secreto.

- [ ] **Step 5: Commit final**

```bash
git add README.md package.json tests/e2e-admin.mjs tests/acceptance.md
git commit -m "test: add acceptance checklist for private panel"
```
