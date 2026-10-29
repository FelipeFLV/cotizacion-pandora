import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

function load() {
  const sandbox = { window: { P }, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../docs/admin/library.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'library.js'
  });
  return sandbox.window.PADMIN.library;
}

function quote(name) {
  return {
    meta: { client: name || 'H&S Inmobiliaria', date: '2026-10-27', slug: 'h-s-7k2m', publishedUrl: 'https://example.test/c/h-s/' },
    blocks: [{ serviceId: 'metaads', title: 'Meta Ads', serviceName: 'Meta Ads' }, { title: 'Contenido' }]
  };
}

const library = load();
const state = (row) => library.state(row);
const render = (input) => library.render(input);

test('row state', () => {
  assert.equal(state({ is_template: true }), 'template');
  assert.equal(state({ status: 'published', retired_at: null }), 'published');
  assert.equal(state({ status: 'retired' }), 'retired');
  assert.equal(state({ status: 'draft' }), 'draft');
  assert.equal(state({ status: 'draft', pending: true }), 'pending');
});

test('a template has no publish or archive actions', () => {
  const html = render({ quotes: [{ id: 'q1', is_template: true, data: quote(), status: 'draft' }], activeId: 'q1' });
  assert.doesNotMatch(html, /data-action="publish"/);
  assert.doesNotMatch(html, /data-action="archive"/);
  assert.match(html, /data-action="new-client"/);
});

test('a published quote shows its url and actions', () => {
  const html = render({ quotes: [{ id: 'q1', is_template: false, data: quote(), status: 'published', slug: 'h-s-7k2m' }], activeId: 'q1' });
  assert.match(html, /data-action="publish"/);
  assert.match(html, /data-action="archive"/);
  assert.match(html, /https:\/\/example\.test\/c\/h-s\//);
  assert.match(html, /Meta Ads/);
});

test('filters and search narrow the list', () => {
  const quotes = [
    { id: 'a', data: quote('Alfa'), status: 'draft' },
    { id: 'b', data: quote('Beta'), status: 'published', slug: 'beta-1' }
  ];
  const rows = (html) => (html.match(/class="quote-row/g) || []).length;
  assert.equal(rows(render({ quotes, filter: 'draft' })), 1);
  assert.equal(rows(render({ quotes, filter: 'published' })), 1);
  assert.equal(rows(render({ quotes, query: 'bet' })), 1);
  assert.equal(rows(render({ quotes, query: 'zeta' })), 0);
});

test('list content is escaped', () => {
  const html = render({
    quotes: [{ id: 'q1', data: quote('<img src=x onerror=alert(1)>'), status: 'draft' }]
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('empty state invites importing or starting from a template', () => {
  const html = render({ quotes: [] });
  assert.match(html, /Importa tu biblioteca|plantilla/i);
});
