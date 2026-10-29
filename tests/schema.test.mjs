import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const TABLES = ['quotes', 'quote_versions', 'media', 'bank_items', 'publish_jobs'];

test('schema defines the five tables', () => {
  const schema = read('20261028000001_schema.sql');
  for (const table of TABLES) {
    assert.match(schema, new RegExp(`create table public\\.${table}`, 'i'), table);
  }
});

test('every table enables RLS with owner policies', () => {
  const rls = read('20261028000002_rls.sql');
  for (const table of TABLES) {
    assert.match(rls, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), table);
  }
  assert.match(rls, /owner_id = auth\.uid\(\)/);
  assert.match(rls, /to authenticated/);
});

test('storage policies scope by user folder', () => {
  const storage = read('20261028000003_storage.sql');
  assert.match(storage, /'drafts',\s*'drafts',\s*false/i);
  assert.match(storage, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  assert.equal((storage.match(/create policy/g) || []).length, 4);
});

test('the template is protected', () => {
  const schema = read('20261028000001_schema.sql');
  assert.match(schema, /template_not_archived/);
  assert.match(schema, /quotes_protect_template/);
  assert.match(schema, /quote_versions_prune/);
});
