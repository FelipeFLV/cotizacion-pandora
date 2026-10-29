import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../js/catalog.js');
require('../js/store.js');

function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    has: (key) => map.has(key),
    map
  };
}

function legacyQuote() {
  const quote = JSON.parse(JSON.stringify(P.defaultQuote()));
  quote.version = 1;
  delete quote.id;
  delete quote.evidence;
  delete quote.meta.slug;
  delete quote.meta.generatedAt;
  delete quote.meta.publishedUrl;
  delete quote.meta.publishedAt;
  quote.blocks.forEach((block) => { delete block.serviceName; });
  return quote;
}

test('migrates the old single quote', () => {
  const storage = fakeStorage({ [P.library.OLD_KEY]: JSON.stringify(legacyQuote()) });
  const lib = P.library.load(storage);

  assert.equal(lib.quotes.length, 1);
  assert.equal(lib.activeId, lib.quotes[0].id);
  assert.equal(lib.quotes[0].quote.version, 2);
  assert.equal(lib.quotes[0].quote.evidence.mode, 'service');
  assert.equal(lib.quotes[0].quote.blocks[0].serviceName, 'Meta Ads');
  assert.equal(lib.quotes[0].quote.meta.slug, P.LEGACY_HS_SLUG, 'la cotización heredada conserva su slug');
  assert.equal(storage.has(P.library.OLD_KEY), false);
  assert.equal(storage.has(P.library.KEY), true);
});

test('add, duplicate and remove', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  const first = lib.activeId;

  P.library.add(lib, P.newQuote('branding'));
  assert.equal(lib.quotes.length, 2);
  assert.equal(lib.activeId, lib.quotes[1].id);

  P.library.duplicate(lib, first);
  assert.equal(lib.quotes.length, 3);
  assert.match(lib.quotes[2].name, /\(copia\)/);
  assert.equal(lib.quotes[2].quote.meta.slug, '');
  assert.equal(lib.quotes[2].quote.id, lib.quotes[2].id);

  assert.equal(P.library.remove(lib, lib.quotes[2].id), true);
  assert.equal(P.library.remove(lib, lib.quotes[0].id), true);
  assert.equal(lib.quotes.length, 1);
  assert.equal(P.library.remove(lib, lib.quotes[0].id), false);
});

test('a new client from the draft gets its own identity', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  const draftId = lib.quotes[0].id;

  assert.equal(P.library.setDraft(lib, draftId).id, draftId);
  assert.equal(lib.quotes[0].quote.meta.isDraft, true);

  const entry = P.library.newClientFrom(lib, draftId);
  assert.notEqual(entry.id, draftId);
  assert.equal(entry.quote.meta.client, 'Cliente sin nombre');
  assert.equal(entry.quote.meta.quoteNo, '');
  assert.equal(entry.quote.meta.slug, '');
  assert.equal(entry.quote.meta.publishedUrl, '');
  assert.equal(entry.quote.meta.isDraft, false);
  assert.equal(entry.quote.blocks.length, 1);
  assert.equal(lib.quotes[0].quote.meta.isDraft, true, 'el borrador sigue intacto');
  assert.equal(lib.activeId, entry.id);
  assert.equal(P.library.remove(lib, draftId), false, 'el borrador no se elimina');
});

test('only an unpublished quote can be the draft', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  lib.quotes[0].quote.meta.publishedUrl = 'https://example.test/c/cliente/';

  assert.equal(P.library.setDraft(lib, lib.quotes[0].id), null);
  assert.notEqual(lib.quotes[0].quote.meta.isDraft, true);
});

test('normalize keeps a single draft', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  const second = P.library.add(lib, P.newQuote('branding'));
  lib.quotes[0].quote.meta.isDraft = true;
  second.quote.meta.isDraft = true;

  P.library.normalize(lib);
  assert.equal(lib.quotes.filter((entry) => entry.quote.meta.isDraft).length, 1);
  assert.equal(lib.quotes[0].quote.meta.isDraft, true);
});

test('snapshots cap at ten and restore', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);

  for (let i = 0; i < 12; i += 1) P.library.snapshot(lib, lib.activeId, `v${i}`);
  assert.equal(lib.quotes[0].versions.length, 10);
  assert.equal(lib.quotes[0].versions[0].label, 'v11');

  const at = lib.quotes[0].versions[0].at;
  const restored = P.library.restore(lib, lib.activeId, at);
  assert.equal(restored.id, lib.activeId);
  assert.equal(lib.quotes[0].quote.meta.client, restored.meta.client);
});

test('an unknown library version is backed up before reset', () => {
  const broken = { version: 2, activeId: 'q_x', quotes: [{ id: 'q_x', quote: P.defaultQuote() }] };
  const storage = fakeStorage({ [P.library.KEY]: JSON.stringify(broken) });
  P.library.load(storage);

  assert.ok(storage.getItem(P.library.BACKUP_KEY), 'guarda una copia del original');
  assert.match(storage.getItem(P.library.BACKUP_KEY), /"version":2/);
});

test('an emptied bank is not reseeded on reload', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  lib.evidenceBank = { videos: [], images: [] };
  P.library.save(lib, storage);

  const again = P.library.load(storage);
  assert.equal(again.evidenceBank.videos.length, 0);
  assert.equal(again.evidenceBank.images.length, 0);
});

test('save and load round-trip keeps the library', () => {
  const storage = fakeStorage();
  const lib = P.library.load(storage);
  lib.quotes[0].quote.meta.client = 'Cliente Guardado';
  assert.equal(P.library.save(lib, storage), true);

  const again = P.library.load(storage);
  assert.equal(again.quotes[0].quote.meta.client, 'Cliente Guardado');
  assert.equal(again.quotes.length, 1);
});
