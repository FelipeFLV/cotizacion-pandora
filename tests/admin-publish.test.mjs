import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

function load() {
  const window = { P, navigator: { clipboard: { async writeText(value) { window.copied = value; } } } };
  const sandbox = { window, console };
  vm.createContext(sandbox);
  for (const file of ['history.js', 'publish.js']) {
    vm.runInContext(readFileSync(new URL(`../docs/admin/${file}`, import.meta.url), 'utf8'), sandbox, {
      filename: file
    });
  }
  return { PADMIN: window.PADMIN, window };
}

const URL_SITE = 'https://felipeflv.github.io/cotizacion-pandora/c/cliente-01-9k4d/';

function row(overrides) {
  return Object.assign({
    id: 'q1',
    status: 'draft',
    slug: null,
    published_url: '',
    is_template: false,
    data: { meta: { client: 'Cliente 01' } }
  }, overrides || {});
}

test('a draft offers publish and no copy while there is no URL', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row());
  const html = PADMIN.publish.render();

  assert.match(html, /pill-draft">Borrador/);
  assert.match(html, /data-op="pub-publish" type="button">Publicar</);
  assert.match(html, /data-op="pub-retire" type="button" disabled/);
  assert.match(html, /data-op="pub-copy" type="button" disabled/);
  assert.match(html, /Sin URL todavía/);
});

test('a published quote shows the url, republicar and open', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row({ status: 'published', slug: 'cliente-01-9k4d', published_url: URL_SITE }));
  const html = PADMIN.publish.render();

  assert.match(html, /pill-published">Publicada/);
  assert.match(html, />Republicar</);
  assert.match(html, /href="https:\/\/felipeflv\.github\.io\/cotizacion-pandora\/c\/cliente-01-9k4d\/"/);
  assert.match(html, /data-op="pub-retire" type="button">Retirar</);
});

test('a template cannot be published', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row({ is_template: true }));
  const html = PADMIN.publish.render();
  assert.match(html, /pill-template">Plantilla/);
  assert.match(html, /data-op="pub-publish" type="button" disabled/);
  assert.match(html, /La plantilla no se publica/);
});

test('a quote without a client cannot be published', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row({ data: { meta: {} } }));
  const html = PADMIN.publish.render();
  assert.match(html, /data-op="pub-publish" type="button" disabled/);
  assert.match(html, /Escribe el nombre del cliente/);
});

test('a retired quote can be published again from the same url', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row({ status: 'retired', retired_at: '2026-10-29T10:00:00.000Z', published_url: URL_SITE }));
  const html = PADMIN.publish.render();
  assert.match(html, /pill-retired">Retirada/);
  assert.match(html, />Publicar de nuevo</);
});

test('urls and client names are escaped', () => {
  const { PADMIN } = load();
  PADMIN.publish.setRow(row({
    status: 'published',
    published_url: 'https://x.test/c/?a=1&b="<script>"',
    data: { meta: { client: '<b>Cliente</b>' } }
  }));
  const html = PADMIN.publish.render();
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>Cliente<\/b>/);
  assert.match(html, /&amp;b=&quot;&lt;script&gt;&quot;/);
});

test('copy reports success and repaints', async () => {
  const { PADMIN, window } = load();
  PADMIN.publish.setRow(row({ status: 'published', published_url: URL_SITE }));
  await PADMIN.publish.op('pub-copy');
  assert.equal(window.copied, URL_SITE);
  assert.match(PADMIN.publish.render(), /URL copiada/);
});

test('the history lists versions and escapes their labels', () => {
  const { PADMIN } = load();
  const html = PADMIN.history.render({
    versions: [
      { id: 'v2', label: 'Publicación', published: true, created_at: new Date(2026, 9, 29, 10, 5).toISOString() },
      { id: 'v1', label: '<b>Antes</b>', published: false, created_at: new Date(2026, 9, 28, 9, 0).toISOString() }
    ]
  });
  assert.match(html, /29\/10\/2026 10:05/);
  assert.match(html, /Publicación/);
  assert.match(html, /&lt;b&gt;Antes&lt;\/b&gt;/);
  assert.match(html, /data-op="hist-restore" data-id="v1"/);
  assert.match(html, /pill-published">Publicada/);
});

test('an empty history explains when versions are saved', () => {
  const { PADMIN } = load();
  const html = PADMIN.history.render({ versions: [] });
  assert.match(html, /Todavía no hay versiones/);
  assert.match(html, /al publicar/);
});

test('the panel loads publish and history before the app boots', () => {
  const html = readFileSync(new URL('../docs/admin/index.html', import.meta.url), 'utf8');
  const order = ['publish.js', 'history.js', 'app.js'].map((file) => html.indexOf(file));
  assert.ok(order.every((index) => index >= 0), 'faltan scripts');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'orden de scripts');

  const editor = readFileSync(new URL('../docs/admin/editor.js', import.meta.url), 'utf8');
  assert.match(editor, /PADMIN\.publish\.render\(/);
  assert.match(editor, /PADMIN\.publish\.op\(/);
});
