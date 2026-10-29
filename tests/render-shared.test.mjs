import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  slugify,
  uniqueSlug,
  mediaRefs,
  applyMediaMap
} from '../supabase/functions/_shared/render.js';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

test('slugify matches the browser implementation', () => {
  for (const name of ['H&S Inmobiliaria', 'Ñandú  Soluciones', 'Cliente 01', '  ']) {
    assert.equal(slugify(name), P.slugify(name), name);
  }
});

test('long names stay within the slug limit', () => {
  const slug = uniqueSlug('Cliente con un nombre larguísimo para una propuesta '.repeat(4), 'a1b2');
  assert.ok(slug.length <= 64);
  assert.match(slug, /^[a-z0-9][a-z0-9-]+$/);
});

test('mediaRefs finds src and poster', () => {
  const quote = { blocks: [{ videos: [{ src: 'media:a', poster: 'media:b' }], images: [{ src: 'media:c' }] }] };
  const general = { videos: [{ src: 'media:d' }], images: [] };
  assert.deepEqual(mediaRefs(quote, general).sort(), ['a', 'b', 'c', 'd']);
});

test('applyMediaMap rewrites only media refs', () => {
  const quote = { blocks: [{ videos: [{ src: 'media:a', poster: 'assets/x.jpg' }], images: [] }] };
  const out = applyMediaMap(quote, { videos: [], images: [] }, { a: 'assets/c/x/a.webp' });
  assert.equal(out.quote.blocks[0].videos[0].src, 'assets/c/x/a.webp');
  assert.equal(out.quote.blocks[0].videos[0].poster, 'assets/x.jpg');
});
