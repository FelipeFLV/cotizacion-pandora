import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEMPLATE } from '../supabase/functions/_shared/template.js';

const source = readFileSync(new URL('../tools/cliente.template.html', import.meta.url), 'utf8');

test('generated template is byte-identical to the source', () => {
  assert.equal(TEMPLATE, source);
});

test('template keeps every token', () => {
  for (const token of ['TITLE', 'DESCRIPTION', 'QUOTE_ID', 'DATE_ISO', 'DATE_LABEL', 'BASE', 'DATA']) {
    assert.match(TEMPLATE, new RegExp(`\\{\\{${token}\\}\\}`), token);
  }
});
