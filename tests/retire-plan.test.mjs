import test from 'node:test';
import assert from 'node:assert/strict';
import { planRetire, quoteIdFromHtml } from '../supabase/functions/_shared/retire-plan.js';

const SITE = 'https://felipeflv.github.io/cotizacion-pandora';

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
  assert.deepEqual(plan.deletions.sort(), [
    'docs/assets/c/cliente-01-9k4d/a.webp',
    'docs/c/cliente-01-9k4d/index.html'
  ]);
  assert.equal(plan.url, `${SITE}/c/cliente-01-9k4d/`);
});

test('a slug with a longer prefix is not touched', () => {
  const plan = planRetire({
    slug: 'cliente-01',
    siteBase: SITE,
    existingPaths: [
      'docs/c/cliente-01-9k4d/index.html',
      'docs/c/cliente-01/index.html'
    ]
  });
  assert.deepEqual(plan.deletions, ['docs/c/cliente-01/index.html']);
});

test('an already retired page plans no deletions and still returns the url', () => {
  const plan = planRetire({ slug: 'cliente-01-9k4d', siteBase: SITE, existingPaths: [] });
  assert.deepEqual(plan.deletions, []);
  assert.equal(plan.url, `${SITE}/c/cliente-01-9k4d/`);
});

test('unsafe slugs are rejected', () => {
  ['', '../otro', 'Cliente 01', 'a', 'x/../../y'].forEach((slug) => {
    assert.throws(() => planRetire({ slug, siteBase: SITE, existingPaths: [] }), /Slug inválido/);
  });
});

test('the page guard reads the quote id from the published html', () => {
  const html = '<meta name="pandora-quote-id" content="8f14e45f-ceea-467a-9c1e-1a2b3c4d5e6f">';
  assert.equal(quoteIdFromHtml(html), '8f14e45f-ceea-467a-9c1e-1a2b3c4d5e6f');
  assert.equal(quoteIdFromHtml('<html></html>'), '');
  assert.equal(quoteIdFromHtml(''), '');
});
