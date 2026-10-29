import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithub } from '../supabase/functions/_shared/github.js';

function fakeGithub(options) {
  const opts = options || {};
  const calls = [];
  let blobs = 0;

  async function fetchImpl(url, init) {
    const method = (init && init.method) || 'GET';
    const parsed = new URL(url);
    const path = parsed.pathname.replace('/repos/o/r', '') + parsed.search;
    calls.push({ method, path, body: init && init.body ? JSON.parse(init.body) : null });
    const reply = (status, body) => ({
      ok: status >= 200 && status < 300,
      status,
      async json() { return body; },
      async text() { return JSON.stringify(body); }
    });

    if (opts.failAt === 'tree' && method === 'POST' && path === '/git/trees') {
      return reply(500, { message: 'boom' });
    }
    if (method === 'GET' && path === '/git/ref/heads/main') return reply(200, { object: { sha: 'base' } });
    if (method === 'GET' && path === '/git/commits/base') return reply(200, { sha: 'base', tree: { sha: 'tree-base' } });
    if (method === 'GET' && path === '/git/trees/tree-base') return reply(200, { sha: 'tree-base', tree: [] });
    if (method === 'GET' && path === '/git/trees/tree-base?recursive=1') {
      return reply(200, {
        tree: [
          { path: 'docs/assets/c/x/a.webp', type: 'blob', sha: 'old-a' },
          { path: 'docs/assets/c/x', type: 'tree', sha: 'dir' },
          { path: 'docs/assets/media/old.png', type: 'blob', sha: 'old-b' }
        ]
      });
    }
    if (method === 'POST' && path === '/git/blobs') {
      blobs += 1;
      return reply(201, { sha: `blob-${blobs}` });
    }
    if (method === 'POST' && path === '/git/trees') return reply(201, { sha: 'tree-new' });
    if (method === 'POST' && path === '/git/commits') {
      return reply(201, { sha: 'commit-1', html_url: 'https://github.com/o/r/commit/commit-1' });
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') return reply(200, { object: { sha: 'commit-1' } });
    return reply(404, { message: `sin ruta ${method} ${path}` });
  }

  return { fetchImpl, calls };
}

test('commit creates blobs, tree, commit and moves the ref', async () => {
  const fake = fakeGithub();
  const gh = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: fake.fetchImpl });
  const out = await gh.commit({
    message: 'Publicar cliente',
    files: [
      { path: 'docs/c/x/index.html', content: '<html>', encoding: 'utf8' },
      { path: 'docs/assets/c/x/a.webp', content: 'AAAA', encoding: 'base64' }
    ],
    deletions: ['docs/assets/c/x/old.webp']
  });

  assert.equal(out.sha, 'commit-1');
  assert.equal(out.url, 'https://github.com/o/r/commit/commit-1');
  assert.deepEqual(fake.calls.map((call) => `${call.method} ${call.path}`), [
    'GET /git/ref/heads/main',
    'GET /git/commits/base',
    'POST /git/blobs',
    'POST /git/blobs',
    'POST /git/trees',
    'POST /git/commits',
    'PATCH /git/refs/heads/main'
  ]);

  const blobs = fake.calls.filter((call) => call.path === '/git/blobs').map((call) => call.body);
  assert.deepEqual(blobs[0], { content: '<html>', encoding: 'utf8' });
  assert.deepEqual(blobs[1], { content: 'AAAA', encoding: 'base64' });

  const tree = fake.calls.find((call) => call.path === '/git/trees').body;
  assert.equal(tree.base_tree, 'tree-base');
  assert.deepEqual(tree.tree, [
    { path: 'docs/c/x/index.html', mode: '100644', type: 'blob', sha: 'blob-1' },
    { path: 'docs/assets/c/x/a.webp', mode: '100644', type: 'blob', sha: 'blob-2' },
    { path: 'docs/assets/c/x/old.webp', mode: '100644', type: 'blob', sha: null }
  ]);

  const commit = fake.calls.find((call) => call.path === '/git/commits').body;
  assert.equal(commit.message, 'Publicar cliente');
  assert.deepEqual(commit.parents, ['base']);

  const patch = fake.calls.find((call) => call.method === 'PATCH').body;
  assert.equal(patch.force, false);
  assert.equal(patch.sha, 'commit-1');
});

test('a failed tree does not move the ref', async () => {
  const fake = fakeGithub({ failAt: 'tree' });
  const gh = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: fake.fetchImpl });
  await assert.rejects(gh.commit({ message: 'x', files: [], deletions: [] }));
  assert.equal(fake.calls.some((call) => call.method === 'PATCH'), false);
});

test('listPaths returns only blobs under the prefix', async () => {
  const fake = fakeGithub();
  const gh = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: fake.fetchImpl });
  const paths = await gh.listPaths('docs/assets/c/x/');
  assert.deepEqual(paths, ['docs/assets/c/x/a.webp']);
});

test('a 5xx is retried once, a 4xx is not', async () => {
  const calls = [];
  const scripted = (statusFor) => {
    const seen = new Set();
    return async (url, init) => {
      const method = (init && init.method) || 'GET';
      const path = new URL(url).pathname.replace('/repos/o/r', '');
      calls.push(`${method} ${path}`);
      const status = seen.has(path) ? 200 : statusFor(path) || 200;
      seen.add(path);
      const body = path === '/git/ref/heads/main'
        ? { object: { sha: 'base' } }
        : path === '/git/commits/base'
          ? { tree: { sha: 'tree-base' } }
          : { sha: 'x' };
      return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return body; }
      };
    };
  };

  const server = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: scripted((path) => (path === '/git/commits/base' ? 502 : 200)) });
  await server.commit({ message: 'x', files: [], deletions: [] });
  assert.equal(calls.filter((call) => call === 'GET /git/commits/base').length, 2);

  calls.length = 0;
  const client = createGithub({ token: 't', repo: 'o/r', branch: 'main', fetchImpl: scripted((path) => (path === '/git/commits/base' ? 422 : 200)) });
  await assert.rejects(client.commit({ message: 'x', files: [], deletions: [] }), /422/);
  assert.equal(calls.filter((call) => call === 'GET /git/commits/base').length, 1);
});
