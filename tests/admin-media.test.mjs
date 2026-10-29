import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

function load(files) {
  const sandbox = { window: { P }, console };
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(`../docs/admin/${file}`, import.meta.url), 'utf8'), sandbox, {
      filename: file
    });
  }
  return sandbox.window.PADMIN;
}

const PADMIN = load(['editor-model.js', 'media.js', 'evidence.js']);
const media = PADMIN.media;
const evidence = PADMIN.evidence;

const plain = (value) => JSON.parse(JSON.stringify(value));

test('fit keeps the aspect ratio under the cap', () => {
  assert.deepEqual(plain(media.fit(4000, 3000, 1800)), { width: 1800, height: 1350 });
  assert.deepEqual(plain(media.fit(800, 600, 1800)), { width: 800, height: 600 });
  assert.deepEqual(plain(media.fit(1200, 4000, 1800)), { width: 540, height: 1800 });
  assert.deepEqual(plain(media.fit(0, 0, 1800)), { width: 0, height: 0 });
});

test('video links', () => {
  assert.equal(media.videoError('https://youtu.be/abc123'), '');
  assert.equal(media.videoError('https://www.youtube.com/watch?v=abc123def45'), '');
  assert.equal(media.videoError('https://vimeo.com/123456'), '');
  assert.equal(media.videoError('https://example.com/x.mp4'), 'Usa un enlace de YouTube o Vimeo.');
  assert.equal(media.videoError(''), 'Pega un enlace de YouTube o Vimeo.');
});

test('legacy local video stays valid', () => {
  assert.equal(media.videoError('assets/media/metaads/1.mp4'), '');
});

test('image links accept http and legacy paths only', () => {
  assert.equal(media.imageError('https://example.com/x.jpg'), '');
  assert.equal(media.imageError('assets/media/metaads/1.png'), '');
  assert.equal(media.imageError('javascript:alert(1)'), 'Usa un enlace de imagen o sube un archivo.');
  assert.equal(media.imageError(''), 'Pega un enlace de imagen o sube un archivo.');
});

test('uploads over the hard limits are rejected', () => {
  assert.throws(() => media.assertUpload(1572865, 'image/jpeg', 1572865), /1.5 MB/);
  assert.throws(() => media.assertUpload(16 * 1024 * 1024, 'image/jpeg', 16 * 1024 * 1024), /15 MB/);
  assert.throws(() => media.assertUpload(1000, 'image/gif', 1000), /JPEG, PNG o WebP/);
  assert.doesNotThrow(() => media.assertUpload(1000, 'image/webp', 1000));
});

test('bank items describe uploads, links and legacy assets', () => {
  const upload = media.toBankItem({ mediaId: 'm1', src: 'media:m1' }, 'image', 'Foto', 'Meta Ads');
  assert.deepEqual(plain(upload), {
    kind: 'image',
    title: 'Foto',
    source: 'upload',
    media_id: 'm1',
    url: '',
    service: 'Meta Ads'
  });
  const link = media.toBankItem({ src: 'https://youtu.be/abc123' }, 'video', 'Video', 'Meta Ads');
  assert.equal(link.source, 'url');
  assert.equal(link.media_id, null);
  assert.equal(link.url, 'https://youtu.be/abc123');
  const legacy = media.toBankItem({ src: 'assets/media/metaads/1.mp4' }, 'video', 'Viejo', '');
  assert.equal(legacy.source, 'legacy');
});

test('evidence renders modes, pieces and the bank safely', () => {
  const quote = {
    evidence: { mode: 'both', generalIds: { videos: ['b1'], images: [] } },
    blocks: [
      {
        title: 'Meta Ads',
        videos: [{ title: 'Video <x>', src: 'https://youtu.be/abc123', poster: '' }],
        images: [{ title: 'Foto', src: 'assets/media/metaads/1.png' }]
      }
    ]
  };
  const bank = [{ id: 'b1', kind: 'video', title: 'Banco <video>', url: 'https://youtu.be/xyz', media_id: null }];
  const html = evidence.render({ quote, bank });
  assert.match(html, /data-ev-mode="service"/);
  assert.match(html, /data-ev-mode="both"/);
  assert.match(html, /Video &lt;x&gt;/);
  assert.doesNotMatch(html, /Video <x>/);
  assert.match(html, /data-op="ev-add-video"/);
  assert.match(html, /data-ev-file=/);
  assert.match(html, /Banco &lt;video&gt;/);
  assert.match(html, /data-op="ev-toggle-general"[^>]*data-kind="video"[^>]*data-id="b1"[^>]*checked/);
});

test('evidence ops update the quote immutably', () => {
  const quote = {
    evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
    blocks: [{ title: 'Meta Ads', videos: [], images: [] }]
  };
  const mode = evidence.op('ev-mode', quote, { dataset: { evMode: 'general' } });
  assert.equal(mode.evidence.mode, 'general');
  assert.equal(quote.evidence.mode, 'service');

  const node = {
    dataset: { path: 'blocks.0.videos' },
    parentElement: { querySelector: () => ({ value: 'https://example.com/x.mp4', dataset: {} }) }
  };
  const link = evidence.op('ev-add-video', quote, node);
  assert.equal(link.blocks[0].videos.length, 1);
  assert.equal(link.blocks[0].videos[0].src, 'https://example.com/x.mp4');

  const toggled = evidence.op('ev-toggle-general', quote, {
    dataset: { kind: 'image', id: 'img-1' },
    checked: true
  });
  assert.deepEqual(plain(toggled.evidence.generalIds.images), ['img-1']);
});

test('the editor wires evidence rendering, uploads and the bank', () => {
  const editor = readFileSync(new URL('../docs/admin/editor.js', import.meta.url), 'utf8');
  assert.match(editor, /PADMIN\.evidence\.render\(/);
  assert.match(editor, /data-ev-file/);
  assert.match(editor, /PADMIN\.api\.addBankItem\(/);
  assert.match(editor, /PADMIN\.media\.upload\(/);

  const api = readFileSync(new URL('../docs/admin/api.js', import.meta.url), 'utf8');
  assert.match(api, /async addMedia\(/);
  assert.match(api, /async userId\(/);

  const html = readFileSync(new URL('../docs/admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /i\.ytimg\.com/);
  const order = ['media.js', 'evidence.js', 'editor.js', 'app.js'].map((file) => html.indexOf(file));
  assert.ok(order.every((index) => index >= 0), 'faltan scripts');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'orden de scripts');
});
