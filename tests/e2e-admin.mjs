/* E2E del panel privado. Se salta si faltan las credenciales de prueba.
   No publica nada salvo que E2E_ADMIN_PUBLISH=1 y el panel se sirva desde el
   origen autorizado (ALLOWED_ORIGIN), porque publicar desde localhost está
   bloqueado por CORS a propósito.

   Uso:
     SUPABASE_URL=https://<ref>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service_role> \
     ADMIN_TEST_EMAIL=<correo autorizado> \
     node tests/e2e-admin.mjs
*/
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { launch, watch } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EMAIL = process.env.ADMIN_TEST_EMAIL || '';
const PUBLISH = process.env.E2E_ADMIN_PUBLISH === '1';

if (!SITE || !SERVICE || !EMAIL) {
  console.log('E2E panel: omitido');
  process.exit(0);
}

function anonKey() {
  const config = readFileSync(path.join(root, 'docs/admin/config.js'), 'utf8');
  const match = config.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/);
  if (!match) throw new Error('No se encontró la anon key en docs/admin/config.js');
  return match[1];
}

const ANON = anonKey();

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function rest(pathname, options) {
  const opts = options || {};
  const key = opts.asAnon ? ANON : (opts.token || SERVICE);
  const res = await fetch(`${SITE}${pathname}`, {
    method: opts.method || 'GET',
    headers: Object.assign(
      { apikey: ANON, Authorization: `Bearer ${key}` },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.headers || {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${pathname} → ${res.status} ${text.slice(0, 200)}`);
  return json;
}

async function session() {
  const link = await rest('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: { type: 'magiclink', email: EMAIL }
  });
  const verified = await rest('/auth/v1/verify', {
    method: 'POST',
    asAnon: true,
    body: { type: 'magiclink', token_hash: link.hashed_token }
  });
  return { access_token: verified.access_token, refresh_token: verified.refresh_token, expires_at: verified.expires_at };
}

function fixture() {
  const quote = {
    version: 2,
    id: 'e2e-admin-1',
    evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
    meta: {
      client: 'E2E Panel',
      quoteNo: 'E2E-01',
      date: '2026-10-29',
      duration: '3 meses',
      validity: '30 días',
      taxEnabled: false,
      taxRate: 18,
      payments: [{ label: 'Inicio', pct: 100 }],
      conditions: ['Condición de prueba.'],
      slug: '',
      isDraft: true
    },
    blocks: [
      {
        uid: 'e2e-b1',
        title: 'Meta Ads',
        duration: '3 meses',
        process: [{ title: 'Brief', detail: 'Revisamos objetivos.' }],
        items: [{ label: 'Gestión', amount: 1000 }]
      }
    ]
  };
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    quotes: [{ id: 'e2e-admin-1', name: 'E2E Panel', versions: [], quote }],
    evidenceBank: { videos: [], images: [{ title: 'Pieza', src: 'assets/media/x.jpg', service: 'Meta Ads' }] }
  };
}

async function waitForServer(url) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (error) {
      /* todavía arrancando */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`El servidor local no respondió en ${url}`);
}

const port = await freePort();
const adminUrl = `http://127.0.0.1:${port}/admin/`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--directory', 'docs'], {
  cwd: root,
  stdio: 'ignore'
});

const browser = await launch();
const created = [];
let tokens = null;
let previousTemplate = null;

async function boot(context) {
  const page = await context.newPage();
  const errors = watch(page);
  await page.goto(adminUrl);
  await page.waitForFunction(() => window.PADMIN && window.supabase, null, { timeout: 15000 });
  await page.evaluate(async (session_) => {
    const client = window.supabase.createClient(
      window.PANDORA_ADMIN_CONFIG.SUPABASE_URL,
      window.PANDORA_ADMIN_CONFIG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' } }
    );
    await client.auth.setSession({ access_token: session_.access_token, refresh_token: session_.refresh_token });
  }, tokens);
  await page.reload();
  await page.waitForSelector('#quote-list', { timeout: 15000 });
  return { page, errors };
}

// setTemplate quita la plantilla anterior; hay que devolverla al terminar.
async function restoreTemplate() {
  if (!previousTemplate) return;
  try {
    await rest(`/rest/v1/quotes?id=eq.${previousTemplate}`, { method: 'PATCH', body: { is_template: true } });
    const rows = await rest('/rest/v1/quotes?select=id,is_template&is_template=eq.true');
    assert.equal(rows.length, 1, 'debe quedar una sola plantilla');
    assert.equal(rows[0].id, previousTemplate, 'la plantilla previa debe recuperar su lugar');
  } catch (error) {
    console.log(`E2E panel: no se pudo restaurar la plantilla: ${error.message}`);
  }
}

try {
  await waitForServer(adminUrl);
  tokens = await session();

  const context = await browser.newContext();
  const { page, errors } = await boot(context);

  /* ---------- importar y crear la plantilla ---------- */
  previousTemplate = await page.evaluate(async () => {
    const rows = await PADMIN.api.listQuotes();
    const row = rows.find((item) => item.is_template);
    return row ? row.id : null;
  });
  const imported = await page.evaluate(async (backup) => {
    const result = await PADMIN.api.importBackup(backup);
    return result.quotes.map((row) => ({ id: row.id, slug: row.slug, status: row.status }));
  }, fixture());
  const seeded = imported[0];
  created.push(seeded.id);
  assert.equal(seeded.status, 'draft', 'la cotización importada sin URL nace como borrador');

  const template = await page.evaluate(async (id) => {
    const row = await PADMIN.api.setTemplate(id);
    return { id: row.id, template: row.is_template };
  }, seeded.id);
  assert.equal(template.template, true, 'la cotización pasa a ser plantilla');

  /* ---------- nuevo cliente desde la plantilla ---------- */
  const client = await page.evaluate(async (templateId) => {
    const row = await PADMIN.api.newClientFrom(templateId);
    const data = JSON.parse(JSON.stringify(row.data));
    data.meta.client = 'E2E Cliente';
    data.blocks[0].items[0].amount = 2400;
    const saved = await PADMIN.api.saveQuote(row.id, data);
    return { id: saved.id, slug: saved.slug, client: saved.data.meta.client, amount: saved.data.blocks[0].items[0].amount };
  }, seeded.id);
  created.push(client.id);
  assert.equal(client.slug, null, 'el cliente nuevo no hereda la URL de la plantilla');
  assert.equal(client.amount, 2400);

  /* ---------- otra computadora: mismo correo, otra sesión de navegador ---------- */
  const other = await browser.newContext();
  const second = await boot(other);
  const seen = await second.page.evaluate(async () => {
    const rows = await PADMIN.api.listQuotes();
    const row = rows.find((item) => item.data.meta.client === 'E2E Cliente');
    return row ? { client: row.data.meta.client, amount: row.data.blocks[0].items[0].amount } : null;
  });
  assert.deepEqual(seen, { client: 'E2E Cliente', amount: 2400 }, 'la biblioteca se ve igual desde otra sesión');
  assert.deepEqual(second.errors, [], `errores en la segunda sesión:\n${second.errors.join('\n')}`);
  await other.close();

  /* ---------- vista previa ---------- */
  await page.reload();
  await page.waitForSelector('#quote-list');
  const row = page.locator('#quote-list article', { hasText: 'E2E Cliente' });
  await row.locator('[data-action="open"]').click();
  await page.waitForSelector('#sec-publicacion', { timeout: 15000 });
  await page.locator('button[data-panel="preview"]').first().click();
  const frame = page.frameLocator('#preview-frame');
  await frame.locator('h1').first().waitFor({ timeout: 15000 });
  assert.match((await frame.locator('h1').first().innerText()).trim(), /E2E Cliente/);
  assert.match((await frame.locator('body').innerText()).replace(/\s+/g, ' '), /Total S\/ 2,400\.00/, 'la vista previa muestra el total');

  /* ---------- publicar (solo desde el origen autorizado) ---------- */
  if (PUBLISH) {
    console.log('E2E panel: publicar se verifica aparte, el panel local no está en ALLOWED_ORIGIN');
  }

  assert.deepEqual(errors, [], `errores en el panel:\n${errors.join('\n')}`);
  console.log('E2E panel: OK');
} finally {
  for (const id of created) {
    try {
      await rest(`/rest/v1/quotes?id=eq.${id}`, {
        method: 'PATCH',
        token: tokens ? tokens.access_token : SERVICE,
        body: { is_template: false }
      });
      await rest(`/rest/v1/quotes?id=eq.${id}`, { method: 'DELETE', token: tokens ? tokens.access_token : SERVICE });
    } catch (error) {
      console.log(`E2E panel: no se pudo limpiar ${id}: ${error.message}`);
    }
  }
  await restoreTemplate();
  await browser.close();
  server.kill();
}
