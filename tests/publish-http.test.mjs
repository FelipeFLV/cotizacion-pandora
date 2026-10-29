import test from 'node:test';
import assert from 'node:assert/strict';
import { json, requireUser, HttpError } from '../supabase/functions/_shared/http.js';

function request(token) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://example.com/functions/v1/publish', { method: 'POST', headers });
}

const supabase = {
  auth: {
    async getUser(token) {
      if (token !== 'good') return { data: null, error: new Error('no') };
      return { data: { user: { id: 'u1', email: 'Felipe@Example.com' } }, error: null };
    }
  }
};

test('a request without a token is rejected', async () => {
  await assert.rejects(requireUser(request(''), supabase, 'felipe@example.com'), (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 401);
    return true;
  });
});

test('an invalid token is rejected', async () => {
  await assert.rejects(requireUser(request('bad'), supabase, 'felipe@example.com'), /Sesión no válida/);
});

test('another email is rejected', async () => {
  await assert.rejects(requireUser(request('good'), supabase, 'otro@example.com'), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
});

test('the allowed email is accepted case-insensitively', async () => {
  const user = await requireUser(request('good'), supabase, 'felipe@example.com');
  assert.equal(user.id, 'u1');
});

test('json responses carry the cors headers of the allowed origin', async () => {
  const response = json(200, { ok: true }, 'https://felipeflv.github.io');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://felipeflv.github.io');
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), { ok: true });
});
