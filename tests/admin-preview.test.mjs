import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { applyMediaMap, mediaRefs } from '../supabase/functions/_shared/render.js';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

function load() {
  const sandbox = { window: { P }, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../docs/admin/model-media.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'model-media.js'
  });
  return sandbox.window.PADMIN.modelMedia;
}

const M = load();
const resolve = M.resolve;

function quote() {
  return {
    blocks: [
      {
        videos: [
          { title: 'Uno', src: 'media:a', poster: 'media:p1' },
          { title: 'Dos', src: 'https://youtu.be/abc123', poster: '' },
          { title: 'Tres', src: 'assets/media/x.mp4', poster: 'assets/media/x.jpg' }
        ],
        images: [{ title: 'Cuatro', src: 'media:b' }, { title: 'Cinco', src: 'assets/media/y.jpg' }]
      }
    ]
  };
}

function general() {
  return {
    videos: [{ title: 'General', src: 'media:g1', poster: '' }],
    images: [{ title: 'General img', src: 'media:g2' }]
  };
}

test('media refs become signed urls for preview', () => {
  const out = resolve(quote(), general(), { a: 'https://signed/a', b: 'https://signed/b' });
  assert.equal(out.quote.blocks[0].videos[0].src, 'https://signed/a');
  assert.equal(out.quote.blocks[0].images[0].src, 'https://signed/b');
});

test('posters are resolved too', () => {
  const out = resolve(quote(), general(), { a: 'https://signed/a', p1: 'https://signed/p1' });
  assert.equal(out.quote.blocks[0].videos[0].poster, 'https://signed/p1');
});

test('legacy assets and links are untouched', () => {
  const out = resolve(quote(), general(), {});
  assert.equal(out.quote.blocks[0].videos[2].src, 'assets/media/x.mp4');
  assert.equal(out.quote.blocks[0].images[1].src, 'assets/media/y.jpg');
  assert.equal(out.quote.blocks[0].videos[1].src, 'https://youtu.be/abc123');
});

test('general evidence is resolved and unknown refs survive', () => {
  const out = resolve(quote(), general(), { g1: 'https://signed/g1' });
  assert.equal(out.general.videos[0].src, 'https://signed/g1');
  assert.equal(out.general.images[0].src, 'media:g2');
});

test('resolve does not mutate its inputs', () => {
  const q = quote();
  const g = general();
  resolve(q, g, { a: 'https://signed/a', b: 'https://signed/b', g1: 'x', g2: 'y' });
  assert.equal(q.blocks[0].videos[0].src, 'media:a');
  assert.equal(g.videos[0].src, 'media:g1');
});

test('resolve matches the server media map exactly', () => {
  const map = { a: 'https://signed/a', b: 'https://signed/b', p1: 'https://signed/p1', g1: 'https://signed/g1' };
  const server = applyMediaMap(quote(), general(), map);
  const browser = resolve(quote(), general(), map);
  assert.deepEqual(JSON.parse(JSON.stringify(browser)), JSON.parse(JSON.stringify(server)));
});

test('media refs are found once per piece', () => {
  const ids = mediaRefs(quote(), general());
  assert.deepEqual([...ids].sort(), ['a', 'b', 'g1', 'g2', 'p1']);
});

test('the preview page reuses the client renderer without embedding data', () => {
  const html = readFileSync(new URL('../docs/admin/preview.html', import.meta.url), 'utf8');
  const order = ['../app/core.js', '../app/render.js', '../app/client.js', 'preview.js']
    .map((file) => html.indexOf(file));
  assert.ok(order.every((index) => index >= 0), 'faltan scripts');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'orden de scripts');
  assert.doesNotMatch(html, /__PANDORA__/, 'la vista previa no trae datos embebidos');
  assert.doesNotMatch(html, /<script>/, 'sin scripts inline sujetos a CSP');

  const panel = readFileSync(new URL('../docs/admin/index.html', import.meta.url), 'utf8');
  assert.match(panel, /frame-src 'self'/);
  assert.match(panel, /src="model-media\.js"/);
});

test('the preview sets the asset base for the admin depth', () => {
  const script = readFileSync(new URL('../docs/admin/preview.js', import.meta.url), 'utf8');
  assert.match(script, /P\.assetBase = '\.\.\/'/);
  assert.match(script, /pandora-preview-ready/);
  assert.match(script, /event\.origin !== ORIGIN/);
});
