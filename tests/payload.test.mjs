import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../js/catalog.js');

const NOW = new Date(2026, 9, 27, 15, 0);

test('service mode keeps service media and drops the bank', () => {
  const q = P.defaultQuote();
  q.evidence.mode = 'service';
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW });

  assert.ok(p.quote.blocks[0].videos.length >= 2);
  assert.equal(p.general.videos.length, 0);
  assert.equal(p.quote.meta.date, '2026-10-27');
  assert.equal(q.blocks[0].videos.length >= 2, true, 'no muta la cotización original');
});

test('general mode keeps only the selected bank pieces', () => {
  const bank = P.seedEvidenceBank();
  const q = P.defaultQuote();
  q.evidence = { mode: 'general', generalIds: { videos: [bank.videos[0].id], images: [bank.images[1].id] } };

  const p = P.buildClientPayload(q, { bank, now: NOW });

  assert.equal(p.quote.blocks[0].videos.length, 0);
  assert.equal(p.quote.blocks[0].images.length, 0);
  assert.deepEqual(p.general.videos.map((piece) => piece.id), [bank.videos[0].id]);
  assert.deepEqual(p.general.images.map((piece) => piece.id), [bank.images[1].id]);
});

test('both mode keeps service media and the selection', () => {
  const bank = P.seedEvidenceBank();
  const q = P.defaultQuote();
  q.evidence = { mode: 'both', generalIds: { videos: [bank.videos[0].id], images: [] } };
  const p = P.buildClientPayload(q, { bank, now: NOW });

  assert.ok(p.quote.blocks[0].videos.length >= 2);
  assert.equal(p.general.videos.length, 1);
  assert.equal(p.general.images.length, 0);
});

test('none mode strips every media and does not block on blob', () => {
  const q = P.defaultQuote();
  q.evidence.mode = 'none';
  q.blocks[0].videos = [{ title: 'temporal', src: 'blob:http://x/y' }];
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW });

  assert.equal(p.quote.blocks[0].videos.length, 0);
  assert.equal(p.general.videos.length, 0);
  assert.deepEqual(P.validateMedia(p), []);
});

test('slug is stable once set', () => {
  const q = P.defaultQuote();
  q.meta.slug = 'cliente-fijo';
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW });
  assert.equal(p.slug, 'cliente-fijo');
  assert.match(P.buildClientPayload(P.defaultQuote(), { bank: P.seedEvidenceBank(), now: NOW }).slug, /^h-s-inmobiliaria-[a-z0-9]{4}$/);
});

test('included blob is rejected', () => {
  const q = P.defaultQuote();
  q.blocks[0].videos[0].src = 'blob:http://x/y';
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW });
  assert.deepEqual(P.validateMedia(p).map((e) => e.reason), ['blob']);
});

test('data video and oversized images are rejected', () => {
  const q = P.defaultQuote();
  q.blocks[0].videos[0].src = 'data:video/mp4;base64,AAAA';
  q.blocks[0].images[0].src = `data:image/png;base64,${'A'.repeat(2200000)}`;
  const reasons = P.validateMedia(P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW })).map((e) => e.reason);
  assert.deepEqual(reasons.sort(), ['data-image-size', 'data-video']);
});

test('unsafe schemes are rejected', () => {
  const q = P.defaultQuote();
  q.blocks[0].videos[0].src = 'javascript:alert(1)';
  q.blocks[0].videos[1].src = 'file:///etc/passwd';
  const reasons = P.validateMedia(P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW })).map((e) => e.reason);
  assert.deepEqual(reasons, ['scheme', 'scheme']);
});

test('missing asset is reported with the path', () => {
  const q = P.defaultQuote();
  const p = P.buildClientPayload(q, { bank: P.seedEvidenceBank(), now: NOW });
  const errors = P.validateMedia(p, { exists: () => false });
  assert.ok(errors.some((e) => e.reason === 'missing' && e.src.startsWith('assets/')));
  assert.ok(errors.every((e) => e.src.startsWith('assets/') || /^https?:/.test(e.src)));
});
