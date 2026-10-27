import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.TZ = 'America/Lima';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

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
