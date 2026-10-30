import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadRender() {
  const P = {};
  const sandbox = { P, window: { P }, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../docs/app/render.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'render.js'
  });
  return P.render;
}

const R = loadRender();

test('a file name is not a caption', () => {
  assert.equal(R.captionText('118767855_1500135286853711_6259075927765278078_n'), '');
  assert.equal(R.captionText('IMG_4821.JPG'), '');
  assert.equal(R.captionText('foto.webp'), '');
  assert.equal(R.captionText('captura-2026-10-29.png'), '');
  assert.equal(R.captionText('whatsapp image 2026-10-29'), '');
});

test('generic labels are not a caption', () => {
  assert.equal(R.captionText('Video'), '');
  assert.equal(R.captionText('imagen'), '');
  assert.equal(R.captionText('Sin título'), '');
  assert.equal(R.captionText('   '), '');
  assert.equal(R.captionText(null), '');
});

test('a real caption survives', () => {
  assert.equal(R.captionText('Campaña Soléol'), 'Campaña Soléol');
  assert.equal(R.captionText(' Reel para ParFit '), 'Reel para ParFit');
});
