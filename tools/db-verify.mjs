/* Verifica que RLS y el bucket privado no expongan datos.
   Uso:
   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node tools/db-verify.mjs
   Sale con 0 si todo se cumple, 1 si falla y 2 si faltan variables. */

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!URL_BASE || !ANON || !SERVICE) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const sfx = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const emailA = `rls-a-${sfx}@example.com`;
const emailB = `rls-b-${sfx}@example.com`;
const password = `probe-${sfx}-Aa1!`;
const created = [];
let failures = 0;
let storagePath = '';

function check(condition, message) {
  if (condition) {
    console.log(`  ok  ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body instanceof Uint8Array ? body : (body ? JSON.stringify(body) : undefined)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (err) { json = null; }
  return { status: res.status, json, text };
}

async function admin(path, options) {
  return call(path, { ...options, token: SERVICE });
}

async function createUser(email) {
  const res = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true }
  });
  if (res.status >= 300) throw new Error(`No se pudo crear ${email}: ${res.status} ${res.text}`);
  created.push(res.json.id);
  return res.json;
}

async function signIn(email) {
  const res = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password }
  });
  if (res.status >= 300) throw new Error(`No se pudo iniciar sesión: ${res.status} ${res.text}`);
  return res.json.access_token;
}

async function main() {
  console.log('Preparando usuarios de prueba…');
  const userA = await createUser(emailA);
  const userB = await createUser(emailB);
  const tokenA = await signIn(emailA);
  const tokenB = await signIn(emailB);

  const insert = await call('/rest/v1/quotes', {
    method: 'POST',
    token: tokenA,
    headers: { Prefer: 'return=representation' },
    body: { owner_id: userA.id, data: { meta: { client: 'rls probe' }, blocks: [{}] } }
  });
  check(insert.status < 300, 'el dueño puede insertar su cotización');

  const anonList = await call('/rest/v1/quotes?select=id');
  check(anonList.status === 401 || (Array.isArray(anonList.json) && anonList.json.length === 0),
    'sin sesión no se lee ninguna cotización');

  const bList = await call('/rest/v1/quotes?select=id', { token: tokenB });
  check(Array.isArray(bList.json) && bList.json.length === 0, 'otro usuario no ve la cotización ajena');

  storagePath = `${userA.id}/probe.png`;
  const upload = await call(`/storage/v1/object/drafts/${storagePath}`, {
    method: 'POST',
    token: tokenB,
    body: new Uint8Array([137, 80, 78, 71]),
    headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' }
  });
  check(upload.status === 403 || upload.status === 400, 'otro usuario no puede subir a la carpeta ajena');

  const anonObject = await call(`/storage/v1/object/drafts/${storagePath}`);
  check(anonObject.status === 400 || anonObject.status === 401 || anonObject.status === 403,
    'sin sesión no se lee el archivo privado');
}

async function cleanup() {
  if (storagePath) {
    await admin(`/storage/v1/object/drafts/${storagePath}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of created) {
    await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }).catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error(`Error: ${error.message}`);
} finally {
  await cleanup();
}

if (failures) {
  console.error(`\nRLS FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRLS OK');
