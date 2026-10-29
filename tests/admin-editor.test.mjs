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
  vm.runInContext(readFileSync(new URL('../docs/admin/editor-model.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'editor-model.js'
  });
  return sandbox.window.PADMIN.editorModel;
}

const E = load();
const setPath = E.setPath;
const addBlock = E.addBlock;
const moveBlock = E.moveBlock;
const removeBlock = E.removeBlock;
const paymentTotal = E.paymentTotal;
const paymentValid = E.paymentValid;

function quote() {
  return {
    version: 2,
    meta: {
      client: 'H&S Inmobiliaria',
      date: '2026-10-27',
      payments: [{ label: 'Inicio', pct: 60 }, { label: 'Cierre', pct: 40 }],
      taxEnabled: true,
      taxRate: 18,
      conditions: ['Vigencia de 30 días.']
    },
    bank: { holder: 'Pandora Marketing S.A.C.', account: '5702449750023' },
    evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
    blocks: [
      {
        uid: 'b1',
        title: 'Meta Ads',
        deliverables: ['Campañas'],
        considerations: [],
        process: [],
        items: [{ concept: 'Gestión', amount: 1000 }]
      }
    ]
  };
}

test('setPath does not mutate the original', () => {
  const q = quote();
  const next = setPath(q, 'meta.client', 'Nuevo');
  assert.equal(q.meta.client, 'H&S Inmobiliaria');
  assert.equal(next.meta.client, 'Nuevo');
});

test('setPath reaches arrays and numbers', () => {
  const q = setPath(quote(), 'blocks.0.items.0.amount', 2500);
  assert.equal(q.blocks[0].items[0].amount, 2500);
  const listed = setPath(q, 'meta.conditions.0', 'Nueva condición');
  assert.equal(listed.meta.conditions[0], 'Nueva condición');
  assert.equal(q.meta.conditions[0], 'Vigencia de 30 días.');
});

test('blocks can be added, moved and removed', () => {
  let q = quote();
  q = addBlock(q);
  assert.equal(q.blocks.length, 2);
  q = moveBlock(q, 1, 0);
  assert.equal(q.blocks[0].uid, 'b2');
  q = removeBlock(q, 0);
  assert.equal(q.blocks.length, 1);
  assert.equal(removeBlock(q, 0).blocks.length, 1, 'siempre queda un bloque');
});

test('duplicating a block gives it a new uid', () => {
  const q = E.duplicateBlock(quote(), 0);
  assert.equal(q.blocks.length, 2);
  assert.notEqual(q.blocks[1].uid, q.blocks[0].uid);
  assert.equal(q.blocks[1].title, 'Meta Ads');
});

test('items can be added and removed but never left empty', () => {
  let q = E.addItem(quote(), 0);
  assert.equal(q.blocks[0].items.length, 2);
  q = E.removeItem(q, 0, 1);
  assert.equal(q.blocks[0].items.length, 1);
  assert.equal(E.removeItem(quote(), 0, 0).blocks[0].items.length, 1);
});

test('payments must total 100', () => {
  const q = quote();
  q.meta.payments = [{ pct: 60 }, { pct: 30 }];
  assert.equal(paymentTotal(q), 90);
  assert.equal(paymentValid(q), false);
  assert.equal(paymentValid(quote()), true);
});

test('totals come from the shared core', () => {
  const totals = E.totals(quote());
  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.igv, 180);
  assert.equal(totals.grand, 1180);
});

test('the panel mounts the editor and saves through the API only', () => {
  const app = readFileSync(new URL('../docs/admin/app.js', import.meta.url), 'utf8');
  assert.match(app, /PADMIN\.editor\.mount\(/);
  assert.match(app, /PADMIN\.api\.saveQuote\(/);
  assert.doesNotMatch(app, /createVersion/);

  const html = readFileSync(new URL('../docs/admin/index.html', import.meta.url), 'utf8');
  const order = ['editor-model.js', 'form.js', 'editor.js', 'app.js'].map((file) => html.indexOf(file));
  assert.ok(order.every((index) => index >= 0), 'faltan scripts');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'orden de scripts');
});

test('autosave waits before saving', () => {
  const editor = readFileSync(new URL('../docs/admin/editor.js', import.meta.url), 'utf8');
  assert.match(editor, /const DELAY = \d+/);
  assert.match(editor, /setTimeout\(flush, DELAY\)/);
  assert.match(editor, /clearTimeout\(timer\)/);
  assert.match(editor, /PADMIN\.editor = \{[\s\S]*?mount,/);
  assert.match(editor, /repaint: repaintPublish/);
});
