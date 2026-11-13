import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

const NAMES = [
  'init', 'listQuotes', 'getQuote', 'createQuote', 'saveQuote', 'deleteQuote', 'archiveQuote', 'unarchiveQuote',
  'setTemplate', 'duplicateQuote', 'newClientFrom', 'listVersions', 'createVersion',
  'restoreVersion', 'getMedia', 'signedUrl', 'uploadMedia', 'listBankItems', 'addBankItem',
  'removeBankItem', 'listJobs', 'accessToken'
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

test('duplicating a quote starts a fresh automatic date', async () => {
  const inserted = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from() {
      return {
        insert(row) {
          inserted.push(row);
          return {
            select() {
              return { single: async () => ({ data: Object.assign({ id: 'copia' }, row), error: null }) };
            }
          };
        }
      };
    }
  };
  PADMIN.api.init(client);
  const row = await PADMIN.api.duplicateRow({
    data: { meta: { client: 'Cliente', date: '2020-01-01', dateAuto: false }, blocks: [] }
  });
  assert.equal(inserted.length, 1);
  assert.equal(row.data.meta.date, P.todayISO(), 'la copia usa la fecha real');
  assert.equal(row.data.meta.dateAuto, true, 'la copia vuelve a ser automática');
});
