import test from 'node:test';
import assert from 'node:assert/strict';
import { retireQuote } from '../supabase/functions/_shared/retire-core.js';

const SITE = 'https://felipeflv.github.io/cotizacion-pandora';
const NOW = '2026-10-29T10:00:00.000Z';
const SLUG = 'cliente-01-9k4d';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fakeSupabase(state) {
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
      if (mode === 'update') {
        rows.forEach((row) => Object.assign(row, clone(payload)));
        return { data: null, error: null };
      }
      if (single) {
        return rows.length === 1
          ? { data: clone(rows[0]), error: null }
          : { data: null, error: { code: 'PGRST116', message: 'sin filas' } };
      }
      if (maybe) return { data: rows.length ? clone(rows[0]) : null, error: null };
      return { data: rows.map(clone), error: null };
    }

    const api = {
      select() { return api; },
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
      return opts.paths || [];
    },
    async readFile(path) {
      calls.push({ type: 'readFile', path });
      return opts.page || '';
    },
    async commit(input) {
      calls.push({ type: 'commit', input });
      return { sha: 'commit-retire', url: '' };
    }
  };
}

function setup(overrides) {
  const state = {
    quotes: [Object.assign({
      id: 'q1',
      owner_id: 'u1',
      slug: SLUG,
      status: 'published',
      is_template: false,
      archived_at: null,
      retired_at: null,
      published_url: `${SITE}/c/${SLUG}/`,
      data: {
        meta: { client: 'Cliente 01', slug: SLUG, publishedUrl: `${SITE}/c/${SLUG}/` },
        blocks: []
      }
    }, overrides || [])],
    publish_jobs: []
  };
  return { state, supabase: fakeSupabase(state) };
}

function page(id) {
  return `<meta name="pandora-quote-id" content="${id}">`;
}

function paths() {
  return [
    `docs/c/${SLUG}/index.html`,
    `docs/assets/c/${SLUG}/m1.webp`,
    'docs/assets/c/otro/a.webp',
    'docs/assets/media/metaads/1.mp4',
    'docs/c/otro/index.html'
  ];
}

function run(supabase, github, extra) {
  return retireQuote(Object.assign({
    supabase,
    github,
    user: { id: 'u1', email: 'felipe@example.com' },
    quoteId: 'q1',
    siteBase: SITE,
    now: NOW
  }, extra || {}));
}

test('retiring removes only its own files and marks the quote', async () => {
  const { state, supabase } = setup();
  const github = fakeGithub({ paths: paths(), page: page('q1') });
  const result = await run(supabase, github);

  assert.equal(result.ok, true);
  assert.equal(result.url, `${SITE}/c/${SLUG}/`);
  assert.equal(result.deletions, 2);

  const commit = github.calls.find((call) => call.type === 'commit').input;
  assert.deepEqual(commit.deletions, [
    `docs/assets/c/${SLUG}/m1.webp`,
    `docs/c/${SLUG}/index.html`
  ]);
  assert.deepEqual(commit.files, []);
  assert.match(commit.message, new RegExp(SLUG));

  const row = state.quotes[0];
  assert.equal(row.status, 'retired');
  assert.equal(row.retired_at, NOW);
  assert.equal(row.data.meta.retiredAt, NOW);
  assert.equal(row.slug, SLUG);
});

test('a page that belongs to another quote is never deleted', async () => {
  const { state, supabase } = setup();
  const github = fakeGithub({ paths: paths(), page: page('otra-cotizacion') });
  await assert.rejects(run(supabase, github), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
  assert.equal(github.calls.some((call) => call.type === 'commit'), false);
  assert.equal(state.quotes[0].status, 'published');
});

test('a quote that was never published is rejected before github', async () => {
  const { supabase } = setup({ slug: null });
  const github = fakeGithub();
  await assert.rejects(run(supabase, github), /nunca se publicó/);
  assert.equal(github.calls.length, 0);
});

test('another owner cannot retire the quote', async () => {
  const { supabase } = setup({ owner_id: 'u2' });
  const github = fakeGithub();
  await assert.rejects(run(supabase, github), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
  assert.equal(github.calls.some((call) => call.type === 'commit'), false);
});

test('a template cannot be retired', async () => {
  const { supabase } = setup({ is_template: true });
  const github = fakeGithub();
  await assert.rejects(run(supabase, github), /plantilla/i);
  assert.equal(github.calls.length, 0);
});

test('an already empty folder needs no commit but still marks the quote', async () => {
  const { state, supabase } = setup();
  const github = fakeGithub({ paths: ['docs/assets/c/otro/a.webp'], page: '' });
  const result = await run(supabase, github);
  assert.equal(result.deletions, 0);
  assert.equal(github.calls.some((call) => call.type === 'commit'), false);
  assert.equal(state.quotes[0].status, 'retired');
});

function brokenReader(supabase, code) {
  return Object.assign({}, supabase, {
    from(name) {
      if (name !== 'quotes') return supabase.from(name);
      return {
        select() { return this; },
        eq() { return this; },
        single() { return Promise.resolve({ data: null, error: { code, message: 'permission denied' } }); }
      };
    }
  });
}

test('a database error is reported as a failure, not as a missing quote', async () => {
  const { supabase } = setup();
  const github = fakeGithub();
  await assert.rejects(run(brokenReader(supabase, '42501'), github), (error) => {
    assert.equal(error.status, 500);
    assert.match(error.message, /no se pudo leer/i);
    return true;
  });
  assert.equal(github.calls.length, 0);
});
