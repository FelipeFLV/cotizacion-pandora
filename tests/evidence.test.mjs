import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../js/catalog.js');
require('../js/store.js');

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

test('seed has one video and one image per service', () => {
  const bank = P.seedEvidenceBank();
  assert.equal(bank.videos.length, 5);
  assert.equal(bank.images.length, 5);
  assert.ok(bank.videos.every((piece) => piece.id && piece.src && piece.service));
  assert.ok(bank.images.every((piece) => piece.id && piece.src && piece.service));
  assert.match(bank.videos[0].title, /—/);
});

test('a fresh library seeds the bank', () => {
  const lib = P.library.load(fakeStorage());
  assert.equal(lib.evidenceBank.videos.length, 5);
  assert.equal(lib.evidenceBank.images.length, 5);
});

test('removing a bank piece cleans quote selections', () => {
  const lib = P.library.load(fakeStorage());
  const piece = lib.evidenceBank.videos[0];
  lib.quotes[0].quote.evidence.generalIds.videos = [piece.id, 'e_other'];

  assert.equal(P.library.removeBankPiece(lib, 'videos', piece.id), true);
  assert.equal(lib.evidenceBank.videos.some((item) => item.id === piece.id), false);
  assert.deepEqual(lib.quotes[0].quote.evidence.generalIds.videos, ['e_other']);
  assert.equal(P.library.removeBankPiece(lib, 'videos', 'e_missing'), false);
});

test('the catalog keeps the nine current services plus Meta Ads', () => {
  const names = Object.values(P.catalog).map((service) => service.name);
  assert.equal(names.length, 10);
  [
    'Consultoría de Negocios y Marketing',
    'Branding e Identidad Corporativa',
    'Manejo de Redes Sociales',
    'Diseño Gráfico & Identidad Corporativa',
    'Páginas Web',
    'Edición Fotográfica y Audiovisual',
    'Fotografía',
    'Producción Audiovisual',
    'Campañas BTL & Activaciones',
    'Meta Ads'
  ].forEach((name) => assert.ok(names.includes(name), name));
});

test('new services start as editable templates without prices or media', () => {
  ['consultoria', 'web', 'edicion', 'fotografia', 'btl'].forEach((id) => {
    const service = P.catalog[id];
    assert.equal(service.items.length, 0, `${id} sin precios`);
    assert.equal(service.videos.length, 0, `${id} sin videos`);
    assert.equal(service.images.length, 0, `${id} sin imágenes`);
    assert.ok(service.deliverables.length > 0, `${id} con alcance editable`);
    assert.ok(service.process.length > 0, `${id} con proceso`);
  });
});
