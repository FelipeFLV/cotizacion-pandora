import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

const NAMES = [
  'init', 'listQuotes', 'getQuote', 'createQuote', 'saveQuote', 'archiveQuote', 'unarchiveQuote',
  'setTemplate', 'duplicateQuote', 'newClientFrom', 'listVersions', 'createVersion',
  'restoreVersion', 'getMedia', 'signedUrl', 'uploadMedia', 'listBankItems', 'addBankItem',
  'removeBankItem', 'listJobs'
];

function load() {
  const sandbox = { window: { P }, console };
  vm.createContext(sandbox);
  for (const file of ['model.js', 'api.js']) {
    vm.runInContext(readFileSync(new URL(`../docs/admin/${file}`, import.meta.url), 'utf8'), sandbox, {
      filename: file
    });
  }
  return sandbox.window.PADMIN;
}

const PADMIN = load();

test('the data layer exposes the documented interface', () => {
  for (const name of NAMES) {
    assert.equal(typeof PADMIN.api[name], 'function', name);
  }
});

test('the data layer refuses to work without a client', async () => {
  await assert.rejects(() => PADMIN.api.listQuotes(), /inicializada/);
});

test('the data layer never sends owner_id on updates', () => {
  const source = readFileSync(new URL('../docs/admin/api.js', import.meta.url), 'utf8');
  const updates = source.match(/\.update\([^)]*\)/g) || [];
  assert.ok(updates.length > 0);
  for (const call of updates) assert.doesNotMatch(call, /owner_id/);
  assert.match(source, /owner_id:\s*owner/);
});
