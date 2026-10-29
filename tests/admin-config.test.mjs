import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ADMIN = fileURLToPath(new URL('../docs/admin/', import.meta.url));
const ROOT = fileURLToPath(new URL('../', import.meta.url));

function loadWindow() {
  const sandbox = { window: {}, location: { origin: 'https://felipeflv.github.io', pathname: '/cotizacion-pagina/admin/' } };
  vm.runInNewContext(readFileSync(join(ADMIN, 'config.js'), 'utf8'), sandbox);
  return sandbox.window;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('config is public and complete', () => {
  const win = loadWindow();
  const cfg = win.PANDORA_ADMIN_CONFIG;
  assert.ok(cfg, 'falta PANDORA_ADMIN_CONFIG');
  assert.equal(win.PADMIN.config.validate(cfg).length, 0);
  assert.match(cfg.SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.match(cfg.ALLOWED_EMAIL, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  assert.equal(cfg.SUPABASE_ANON_KEY.split('.').length, 3);
});

test('config validation rejects bad values', () => {
  const win = loadWindow();
  const errors = win.PADMIN.config.validate({
    SUPABASE_URL: 'http://example.com',
    SUPABASE_ANON_KEY: 'no-es-un-jwt',
    ALLOWED_EMAIL: 'sin-arroba'
  });
  assert.equal(errors.length, 3);
});

test('no service key reaches the browser', () => {
  const files = walk(ADMIN).filter((file) => !file.includes(`${join('admin', 'vendor')}`));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /service_role|SERVICE_ROLE|sb_secret_/, relative(ROOT, file));
  }
});

test('index loads the panel scripts in order with a strict CSP', () => {
  const html = readFileSync(join(ADMIN, 'index.html'), 'utf8');
  const order = ['vendor/supabase.js', 'config.js', 'auth.js', 'app.js']
    .map((file) => html.indexOf(file));
  assert.ok(order.every((index) => index >= 0), 'faltan scripts');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'orden de scripts');
  const cfg = loadWindow().PANDORA_ADMIN_CONFIG;
  const host = new URL(cfg.SUPABASE_URL).host;
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(csp, 'falta CSP');
  assert.match(csp[1], new RegExp(`connect-src[^;]*https://${host}`));
  assert.match(csp[1], /script-src 'self'/);
});

test('vendor is pinned and present', () => {
  const version = readFileSync(join(ADMIN, 'vendor', 'VERSION'), 'utf8').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const source = readFileSync(join(ADMIN, 'vendor', 'supabase.js'), 'utf8');
  assert.ok(source.length > 10000, 'el vendor parece vacío');
  assert.match(source, /supabase-js/);
});
