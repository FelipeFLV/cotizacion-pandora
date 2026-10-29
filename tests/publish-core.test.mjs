import test from 'node:test';
import assert from 'node:assert/strict';
import { publishQuote } from '../supabase/functions/_shared/publish-core.js';
import { TEMPLATE } from '../supabase/functions/_shared/template.js';

const SITE = 'https://felipeflv.github.io/cotizacion-pandora';
const NOW = '2026-10-28T12:00:00.000Z';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fakeSupabase(state) {
  let seq = 0;

  function builder(name) {
    const filters = [];
    let mode = 'select';
    let payload = null;
    let single = false;
    let maybe = false;

    function matches(row) {
      return filters.every((filter) => (
        filter.in ? filter.in.includes(row[filter.col]) : row[filter.col] === filter.val
      ));
    }

    function result() {
      const rows = (state[name] || []).filter(matches);
      if (mode === 'insert') {
        seq += 1;
        const row = Object.assign({ id: `${name}-${seq}` }, clone(payload));
        (state[name] = state[name] || []).push(row);
        return { data: clone(row), error: null };
      }
      if (mode === 'update') {
        (state[name] || []).filter(matches).forEach((row) => Object.assign(row, clone(payload)));
        return { data: null, error: null };
      }
      if (single) {
        return rows.length === 1
          ? { data: clone(rows[0]), error: null }
          : { data: null, error: new Error('sin filas') };
      }
      if (maybe) return { data: rows.length ? clone(rows[0]) : null, error: null };
      return { data: rows.map(clone), error: null };
    }

    const api = {
      select() { return api; },
      insert(row) { mode = 'insert'; payload = row; return api; },
      update(row) { mode = 'update'; payload = row; return api; },
      eq(col, val) { filters.push({ col, val }); return api; },
      in(col, values) { filters.push({ col, in: values }); return api; },
      order() { return api; },
      limit() { return api; },
      single() { single = true; return Promise.resolve(result()); },
      maybeSingle() { maybe = true; return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
    };
    return api;
  }

  return {
    from(name) {
      state[name] = state[name] || [];
      return builder(name);
    },
    storage: {
      from() {
        return {
          async download(path) {
            const bytes = state.files[path];
            if (!bytes) return { data: null, error: new Error('sin archivo') };
            return { data: new Blob([bytes]), error: null };
          }
        };
      }
    }
  };
}

function fakeGithub(options) {
  const opts = options || {};
  const calls = [];
  return {
    calls,
    async listPaths(prefix) {
      calls.push({ type: 'listPaths', prefix });
      return opts.existing || [];
    },
    async commit(input) {
      calls.push({ type: 'commit', input });
      if (opts.fail) throw new Error('falló el commit');
      return { sha: 'commit-1', url: 'https://github.com/o/r/commit/commit-1' };
    }
  };
}

function quote() {
  return {
    id: 'q1',
    meta: {
      client: 'Cliente 01',
      quoteNo: 'OCT26-01',
      date: '2026-10-28',
      duration: '3 meses',
      validity: '30 días',
      taxEnabled: false,
      taxRate: 18,
      payments: [{ label: 'Inicio', pct: 100 }],
      conditions: []
    },
    evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
    blocks: [
      {
        title: 'Meta Ads',
        duration: '3 meses',
        videos: [{ title: 'Video', src: 'https://youtu.be/abc123', poster: '' }],
        images: [{ title: 'Foto', src: 'media:m1' }]
      }
    ]
  };
}

function setup(overrides) {
  const data = quote();
  const state = {
    quotes: [Object.assign({
      id: 'q1',
      owner_id: 'u1',
      slug: null,
      is_template: false,
      archived_at: null,
      status: 'draft',
      published_url: '',
      data
    }, overrides || {})],
    media: [{ id: 'm1', owner_id: 'u1', storage_path: 'u1/m1.webp', mime: 'image/webp' }],
    bank_items: [],
    quote_versions: [],
    files: { 'u1/m1.webp': new Uint8Array([1, 2, 3]) }
  };
  return { state, supabase: fakeSupabase(state) };
}

function run(state, supabase, github, extra) {
  return publishQuote(Object.assign({
    supabase,
    github: github || fakeGithub(),
    template: TEMPLATE,
    siteBase: SITE,
    user: { id: 'u1', email: 'felipe@example.com' },
    quoteId: 'q1',
    now: NOW
  }, extra || {}));
}

test('publishing commits the page and the private asset, then marks the quote', async () => {
  const { state, supabase } = setup();
  const github = fakeGithub({ existing: ['docs/assets/c/x/old.webp'] });
  const result = await run(state, supabase, github);

  const row = state.quotes[0];
  assert.match(row.slug, /^cliente-01-[a-z0-9]{4}$/);
  assert.equal(row.status, 'published');
  assert.equal(row.published_url, `${SITE}/c/${row.slug}/`);
  assert.equal(row.data.meta.slug, row.slug);
  assert.equal(row.data.meta.publishedUrl, row.published_url);
  assert.equal(row.data.meta.publishedAt, NOW);
  assert.equal(result.url, row.published_url);
  assert.equal(result.commit, 'commit-1');
  assert.equal(result.slug, row.slug);

  assert.equal(state.quote_versions.length, 1);
  assert.equal(state.quote_versions[0].published, true);
  assert.equal(state.quote_versions[0].label, 'Publicación');

  const commit = github.calls.find((call) => call.type === 'commit').input;
  assert.match(commit.message, new RegExp(row.slug));
  const html = commit.files.find((file) => file.path.endsWith('index.html'));
  const asset = commit.files.find((file) => file.path.endsWith('m1.webp'));
  assert.match(html.content, new RegExp(`assets/c/${row.slug}/m1\\.webp`));
  assert.equal(asset.encoding, 'base64');
  assert.equal(asset.content, Buffer.from([1, 2, 3]).toString('base64'));
  assert.deepEqual(commit.deletions, []);
});

test('a failed commit leaves the quote as a draft', async () => {
  const { state, supabase } = setup();
  const github = fakeGithub({ fail: true });
  await assert.rejects(run(state, supabase, github), /falló el commit/);

  const row = state.quotes[0];
  assert.equal(row.status, 'draft');
  assert.equal(row.published_url, '');
  assert.equal(row.data.meta.publishedUrl, undefined);
  assert.equal(state.quote_versions.length, 0);
});

test('a template is rejected before touching github', async () => {
  const { state, supabase } = setup({ is_template: true });
  const github = fakeGithub();
  await assert.rejects(run(state, supabase, github), /plantilla/i);
  assert.equal(github.calls.length, 0);
  assert.equal(state.quote_versions.length, 0);
});

test('another owner cannot publish the quote', async () => {
  const { state, supabase } = setup({ owner_id: 'u2' });
  await assert.rejects(run(state, supabase), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
});

test('a media id without a row is rejected', async () => {
  const { state, supabase } = setup();
  state.media = [];
  const github = fakeGithub();
  await assert.rejects(run(state, supabase, github), /ya no existe/);
  assert.equal(github.calls.some((call) => call.type === 'commit'), false);
});

test('a bank item from another owner is rejected instead of silently dropped', async () => {
  const { state, supabase } = setup();
  state.bank_items = [{ id: 'b9', owner_id: 'u2', kind: 'image', title: 'Ajena', media_id: null, url: 'https://x.test/a.png' }];
  state.quotes[0].data.evidence = { mode: 'both', generalIds: { videos: [], images: ['b9'] } };

  const github = fakeGithub();
  await assert.rejects(run(state, supabase, github), /banco ya no existe/);
  assert.equal(github.calls.some((call) => call.type === 'commit'), false);
});

test('bank evidence is downloaded and rendered for the client', async () => {
  const { state, supabase } = setup();
  state.bank_items = [{ id: 'b1', owner_id: 'u1', kind: 'image', title: 'Banco', media_id: 'm2', url: '', service: '' }];
  state.media.push({ id: 'm2', owner_id: 'u1', storage_path: 'u1/m2.png', mime: 'image/png' });
  state.files['u1/m2.png'] = new Uint8Array([4, 5]);

  const data = state.quotes[0].data;
  data.evidence = { mode: 'both', generalIds: { videos: [], images: ['b1'] } };

  const github = fakeGithub();
  await run(state, supabase, github);
  const commit = github.calls.find((call) => call.type === 'commit').input;
  const paths = commit.files.map((file) => file.path).sort();
  assert.deepEqual(paths, [
    `docs/assets/c/${state.quotes[0].slug}/m1.webp`,
    `docs/assets/c/${state.quotes[0].slug}/m2.png`,
    `docs/c/${state.quotes[0].slug}/index.html`
  ]);
});
