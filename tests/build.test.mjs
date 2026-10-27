import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildClientHtml } from '../tools/publicar-lib.mjs';

const require = createRequire(import.meta.url);
const P = require('../js/catalog.js');

const template = readFileSync(new URL('../tools/cliente.template.html', import.meta.url), 'utf8');

function packageFor(quote) {
  return {
    slug: 'demo',
    generatedAt: '2026-10-27T20:42:00.000Z',
    quote,
    general: { videos: [], images: [] }
  };
}

test('builds a read-only page with quote id and date', () => {
  const quote = P.defaultQuote();
  quote.id = 'q_test';
  quote.meta.date = '2026-10-27';

  const html = buildClientHtml({ template, pkg: packageFor(quote), base: '../../' });

  assert.match(html, /<meta name="pandora-quote-id" content="q_test">/);
  assert.match(html, /27 de octubre de 2026/);
  assert.doesNotMatch(html, /\{\{/);
  assert.match(html, /href="..\/..\/app\/app.css"/);
  assert.doesNotMatch(html, /contenteditable|<input|<textarea|<select/i);
});

test('escapes closing script tags from quote data', () => {
  const quote = P.defaultQuote();
  quote.id = 'q_xss';
  quote.meta.client = '</script><script>alert(1)</script>';
  quote.meta.date = '2026-10-27';

  const html = buildClientHtml({ template, pkg: packageFor(quote), base: '../../' });

  assert.doesNotMatch(html, /<\/script><script>alert\(1\)/);
  assert.match(html, /u003c\/script>/);
});
