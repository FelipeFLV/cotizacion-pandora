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
  vm.runInContext(readFileSync(new URL('../docs/admin/model.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'model.js'
  });
  return sandbox.window.PADMIN;
}

function backup() {
  return {
    version: 1,
    exportedAt: '2026-10-28T12:00:00.000Z',
    quotes: [
      {
        id: 'q_hs',
        name: 'H&S Inmobiliaria',
        versions: [{ at: '2026-10-27T10:00:00.000Z', label: 'Publicada', quote: { meta: {}, blocks: [{}] } }],
        quote: {
          version: 2,
          id: 'q_hs',
          evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
          meta: {
            client: 'H&S Inmobiliaria',
            slug: 'h-s-inmobiliaria-7k2m',
            publishedUrl: 'https://example.test/c/h-s/',
            publishedAt: '2026-10-27T10:00:00.000Z',
            isDraft: true
          },
          blocks: [{ serviceId: 'metaads' }]
        }
      },
      {
        id: 'q_draft',
        name: 'Borrador',
        versions: [],
        quote: {
          version: 2,
          id: 'q_draft',
          evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
          meta: { client: 'Borrador', slug: '', isDraft: true },
          blocks: [{ serviceId: 'metaads' }]
        }
      }
    ],
    evidenceBank: {
      videos: [{ id: 'e1', title: 'Video', src: 'https://youtu.be/x', poster: '', service: 'Meta Ads' }],
      images: [{ id: 'e2', title: 'Imagen', src: 'assets/media/x.jpg', service: 'Meta Ads' }]
    }
  };
}

const PADMIN = load();

test('backup maps to rows without losing identity', () => {
  const out = PADMIN.model.fromBackup(backup(), 'user-1');
  assert.equal(out.quotes.length, 2);
  assert.equal(out.quotes[0].status, 'published');
  assert.equal(out.quotes[0].slug, 'h-s-inmobiliaria-7k2m');
  assert.equal(out.quotes[0].published_url, 'https://example.test/c/h-s/');
  assert.equal(out.quotes[1].status, 'draft');
  assert.equal(out.bank.length, 2);
  assert.equal(out.quotes[0].owner_id, 'user-1');
  assert.equal(out.quotes[0].data.meta.isDraft, undefined);
  assert.equal(out.bank[0].source, 'url');
  assert.equal(out.bank[1].source, 'legacy');
});

test('a retired quote keeps its slug and status', () => {
  const data = backup();
  data.quotes[0].quote.meta.retiredAt = '2026-10-28T09:00:00.000Z';
  const out = PADMIN.model.fromBackup(data, 'user-1');
  assert.equal(out.quotes[0].status, 'retired');
  assert.equal(out.quotes[0].slug, 'h-s-inmobiliaria-7k2m');
});

test('a new client clears identity but keeps content', () => {
  const templateQuote = {
    version: 2,
    evidence: { mode: 'service', generalIds: { videos: ['e1'], images: [] } },
    meta: {
      client: 'H&S Inmobiliaria',
      quoteNo: 'OCT26-23',
      slug: 'h-s-inmobiliaria-7k2m',
      generatedAt: '2026-10-27T10:00:00.000Z',
      publishedUrl: 'https://example.test/c/h-s/',
      publishedAt: '2026-10-27T10:00:00.000Z',
      retiredAt: '',
      retireRequestedAt: '',
      isDraft: true,
      conditions: ['Una condición']
    },
    bank: { holder: 'Pandora Marketing S.A.C.' },
    blocks: [{ serviceId: 'metaads', price: 1200 }]
  };
  const client = PADMIN.model.newClientData(templateQuote);
  assert.equal(client.meta.client, 'Cliente sin nombre');
  assert.equal(client.meta.slug, '');
  assert.equal(client.meta.quoteNo, '');
  assert.equal(client.meta.isDraft, false);
  assert.equal(client.blocks.length, 1);
  assert.equal(client.blocks[0].price, 1200);
  assert.equal(client.evidence.mode, 'service');
  assert.equal(client.meta.publishedUrl, '');
  assert.equal(client.meta.date, P.todayISO());
  assert.equal(client.meta.conditions.length, 1);
});

test('an unknown backup version is rejected', () => {
  assert.throws(() => PADMIN.model.fromBackup({ version: 9 }, 'user-1'), /versión/i);
});

test('an incomplete quote is rejected', () => {
  const data = backup();
  data.quotes[1].quote.blocks = [];
  assert.throws(() => PADMIN.model.fromBackup(data, 'user-1'), /incompleta|bloques/i);
});

test('rows become quotes again for the editor', () => {
  const quote = PADMIN.model.rowToQuote({ data: backup().quotes[0].quote, slug: 'otro-slug' });
  assert.equal(quote.meta.slug, 'otro-slug');
  assert.equal(quote.meta.isDraft, false);
});

test('saving never clears a reserved slug nor changes the status', () => {
  const fresh = PADMIN.model.quoteToPatch({ meta: { client: 'Nuevo', slug: '' }, blocks: [] });
  assert.equal('slug' in fresh, false, 'un slug vacío no debe borrar el de la fila');
  assert.equal('status' in fresh, false, 'el estado solo lo cambian publicar y retirar');

  const published = PADMIN.model.quoteToPatch({ meta: { client: 'Cliente', slug: 'cliente-1-ab12' }, blocks: [] });
  assert.equal(published.slug, 'cliente-1-ab12');
});

test('a backup can be exported and imported again', () => {
  const source = backup();
  const quote = source.quotes[0].quote;
  const rows = [{ id: 'row-1', data: quote, is_template: true }];
  const versions = { 'row-1': [{ data: quote, label: 'Publicación', created_at: '2026-10-29T10:00:00.000Z' }] };
  const bank = [
    { kind: 'image', title: 'Pieza', url: 'assets/media/x.jpg', service: 'Meta Ads' },
    { kind: 'video', title: 'Reel', media_id: 'm1', service: '' },
    { kind: 'image', title: 'Sin origen' }
  ];

  const json = PADMIN.model.toBackup(rows, versions, bank);
  assert.equal(json.version, 1, 'el respaldo usa el formato que la importación entiende');
  assert.equal(json.quotes[0].template, true, 'la plantilla viaja marcada');
  assert.equal(json.quotes[0].name, 'H&S Inmobiliaria');
  assert.equal(json.quotes[0].versions.length, 1);
  assert.equal(json.evidenceBank.images.length, 1, 'las piezas sin origen se omiten');
  assert.equal(json.evidenceBank.videos[0].src, 'media:m1');

  const parsed = PADMIN.model.fromBackup(json, 'user-1');
  assert.equal(parsed.quotes.length, 1);
  assert.equal(parsed.quotes[0].is_template, true);
  assert.equal(parsed.quotes[0].slug, 'h-s-inmobiliaria-7k2m');
  assert.equal(parsed.versions.length, 1);
  assert.equal(parsed.bank.length, 2);
});
