import test from 'node:test';
import assert from 'node:assert/strict';
import { planPublish } from '../supabase/functions/_shared/plan.js';
import { TEMPLATE } from '../supabase/functions/_shared/template.js';

const SITE = 'https://felipeflv.github.io/cotizacion-pandora';
const GENERATED = '2026-10-28T12:00:00.000Z';

function base(blocks) {
  return {
    id: 'q1',
    meta: {
      client: 'Cliente 01',
      quoteNo: 'OCT26-01',
      date: '2026-10-28',
      duration: '3 meses',
      validity: '30 días',
      taxEnabled: true,
      taxRate: 18,
      payments: [{ label: 'Inicio', pct: 100 }],
      conditions: []
    },
    evidencia: undefined,
    evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
    blocks
  };
}

function withMedia() {
  return base([
    {
      title: 'Meta Ads',
      duration: '3 meses',
      videos: [{ title: 'Video', src: 'https://youtu.be/abc123', poster: '' }],
      images: [{ title: 'Foto', src: 'media:a', poster: '' }]
    }
  ]);
}

function withLegacy() {
  return base([
    {
      title: 'Meta Ads',
      duration: '3 meses',
      videos: [{ title: 'Viejo', src: 'assets/media/metaads/1.mp4', poster: '' }],
      images: []
    }
  ]);
}

const empty = () => ({ videos: [], images: [] });

test('media refs become public asset paths', () => {
  const plan = planPublish({
    quote: withMedia(),
    general: empty(),
    slug: 'cliente-01-9k4d',
    siteBase: SITE,
    generatedAt: GENERATED,
    template: TEMPLATE,
    assetPaths: { a: 'a.webp' },
    assets: { a: 'QUJD' }
  });
  assert.match(plan.html, /assets\/c\/cliente-01-9k4d\/a\.webp/);
  assert.doesNotMatch(plan.html, /media:a/);
  assert.equal(plan.url, `${SITE}/c/cliente-01-9k4d/`);
  assert.deepEqual(plan.files.map((file) => file.path).sort(), [
    'docs/assets/c/cliente-01-9k4d/a.webp',
    'docs/c/cliente-01-9k4d/index.html'
  ]);
  assert.equal(plan.files[1].content, 'QUJD');
});

test('legacy assets are kept and nothing outside the slug is deleted', () => {
  const plan = planPublish({
    quote: withLegacy(),
    general: empty(),
    slug: 'h-s-inmobiliaria-7k2m',
    siteBase: SITE,
    generatedAt: GENERATED,
    template: TEMPLATE,
    assetPaths: {},
    existingPaths: [
      'docs/assets/media/metaads/1.mp4',
      'docs/assets/c/h-s-inmobiliaria-7k2m/old.webp'
    ]
  });
  assert.match(plan.html, /assets\/media\/metaads\/1\.mp4/);
  assert.deepEqual(plan.deletions, ['docs/assets/c/h-s-inmobiliaria-7k2m/old.webp']);
});

test('a template cannot be planned', () => {
  assert.throws(
    () => planPublish({
      quote: { meta: { client: 'X' }, blocks: [] },
      template: TEMPLATE,
      isTemplate: true
    }),
    /plantilla/i
  );
});

test('a missing media file is reported with the piece title', () => {
  assert.throws(
    () => planPublish({
      quote: withMedia(),
      general: empty(),
      slug: 'cliente-01-9k4d',
      siteBase: SITE,
      generatedAt: GENERATED,
      template: TEMPLATE,
      assetPaths: {}
    }),
    /Foto/
  );
});

test('unsafe schemes are rejected', () => {
  const quote = base([{ title: 'X', images: [{ title: 'Mala', src: 'javascript:alert(1)' }], videos: [] }]);
  assert.throws(
    () => planPublish({
      quote,
      general: empty(),
      slug: 'cliente-01-9k4d',
      siteBase: SITE,
      generatedAt: GENERATED,
      template: TEMPLATE,
      assetPaths: {}
    }),
    /no permitido/
  );
});

test('new videos must come from youtube or vimeo', () => {
  const quote = base([{ title: 'X', videos: [{ title: 'Suelto', src: 'https://example.com/x.mp4' }], images: [] }]);
  assert.throws(
    () => planPublish({
      quote,
      general: empty(),
      slug: 'cliente-01-9k4d',
      siteBase: SITE,
      generatedAt: GENERATED,
      template: TEMPLATE,
      assetPaths: {}
    }),
    /YouTube o Vimeo/
  );
});

test('the client html carries the slug and no page from another quote', () => {
  const plan = planPublish({
    quote: withMedia(),
    general: empty(),
    slug: 'cliente-01-9k4d',
    siteBase: SITE,
    generatedAt: GENERATED,
    template: TEMPLATE,
    assetPaths: { a: 'a.webp' }
  });
  assert.match(plan.html, /pandora-quote-id" content="q1"/);
  assert.match(plan.html, /Cliente 01/);
  assert.equal(plan.files[0].encoding, 'utf8');
  assert.equal(plan.files[1].encoding, 'base64');
});
