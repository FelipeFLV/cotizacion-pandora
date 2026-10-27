import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import net from 'node:net';
import { launch, watch } from './helpers/browser.mjs';
import { buildClientHtml } from '../tools/publicar-lib.mjs';

const require = createRequire(import.meta.url);
const P = require('../js/catalog.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrixUrl = pathToFileURL(path.join(root, 'index.html')).href;
const base = '../../';

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

function clientPackage(mode) {
  const quote = P.defaultQuote();
  quote.id = 'q_e2e';
  quote.meta.date = '2026-10-27';
  quote.meta.client = 'Cliente Prueba';
  quote.evidence = { mode, generalIds: { videos: [], images: [] } };
  return {
    slug: '_e2e',
    generatedAt: '2026-10-27T20:42:00.000Z',
    quote,
    general: { videos: [], images: [] }
  };
}

function writeClientPage() {
  const template = readFileSync(path.join(root, 'tools/cliente.template.html'), 'utf8');
  const dir = path.join(root, 'docs/c/_e2e');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'index.html'),
    buildClientHtml({ template, pkg: clientPackage('service'), base })
  );
}

async function waitForServer(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      /* el servidor todavía no responde */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`El servidor local no respondió en ${url}`);
}

const serverPort = await freePort();
const serverUrl = `http://127.0.0.1:${serverPort}`;
const browser = await launch();
const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--directory', 'docs'], {
  cwd: root,
  stdio: 'ignore'
});

try {
  /* ---------- matriz ---------- */
  const matrixContext = await browser.newContext();
  const matrix = await matrixContext.newPage();
  const matrixErrors = watch(matrix);

  await matrix.goto(matrixUrl);
  await matrix.waitForSelector('body.ready', { timeout: 10000 });

  const logoWidth = await matrix.locator('.brand img').first().evaluate((img) => img.naturalWidth);
  assert.ok(logoWidth > 0, 'el logo debe cargar desde docs/assets');

  await matrix.locator('[data-action="toggle-edit"]').click();
  const client = matrix.locator('[data-text="meta.client"]').first();
  assert.equal(await client.count(), 1, 'el nombre del cliente debe ser editable');
  await client.fill('Cliente Prueba');
  await matrix.waitForTimeout(700);
  await matrix.reload();
  await matrix.waitForSelector('body.ready');
  const saved = (await matrix.locator('[data-text="meta.client"]').first().innerText()).trim();
  assert.equal(saved, 'Cliente Prueba', 'el nombre editado debe persistir tras recargar');
  assert.deepEqual(matrixErrors, [], `errores en la matriz:\n${matrixErrors.join('\n')}`);
  await matrixContext.close();
  console.log('E2E matriz: OK');

  /* ---------- biblioteca ---------- */
  const libContext = await browser.newContext({ acceptDownloads: true });
  const lib = await libContext.newPage();
  const libErrors = watch(lib);
  lib.on('dialog', (dialog) => dialog.accept());

  await lib.goto(matrixUrl);
  await lib.waitForSelector('body.ready', { timeout: 10000 });
  assert.equal((await lib.locator('[data-library-count]').innerText()).trim(), '1', 'arranca con una cotización');

  await lib.locator('[data-action="open-library"]').click();
  await lib.waitForSelector('#libraryDialog[open]');
  await lib.locator('[data-action="new-quote"]').click();
  await lib.locator('[data-action="pick-service"][data-service="branding"]').click();
  await lib.waitForFunction(() => document.body.classList.contains('ready'));

  assert.equal((await lib.locator('[data-library-count]').innerText()).trim(), '2', 'la nueva cotización se agrega');
  await lib.locator('[data-action="toggle-edit"]').click();
  const newClient = lib.locator('[data-text="meta.client"]').first();
  assert.equal((await newClient.innerText()).trim(), 'Cliente sin nombre');
  await newClient.fill('Cliente Beta');
  await lib.waitForTimeout(700);
  const hint = (await lib.locator('.edit-hint').innerText()).trim();
  assert.match(hint, /Guardado en este navegador · \d{2}:\d{2}/, 'el pie confirma el guardado con la hora');

  await lib.locator('[data-action="open-library"]').click();
  await lib.waitForSelector('#libraryDialog[open]');
  assert.equal(await lib.locator('.library-row').count(), 2, 'la biblioteca lista dos cotizaciones');
  assert.match(await lib.locator('.library-row').nth(1).locator('.library-name').innerText(), /Cliente Beta/);

  await lib.locator('.library-row').nth(0).locator('[data-action="duplicate-quote"]').click();
  assert.equal((await lib.locator('[data-library-count]').innerText()).trim(), '3', 'duplicar suma una tercera');
  assert.equal(await lib.locator('.library-row').count(), 3);
  assert.equal(await lib.locator('.library-name', { hasText: '(copia)' }).count(), 1, 'la copia se distingue');

  await lib.locator('.library-row').nth(0).locator('.library-main').click();
  await lib.locator('body.ready');
  await lib.reload();
  await lib.waitForSelector('body.ready');
  assert.equal((await lib.locator('[data-library-count]').innerText()).trim(), '3', 'el contador persiste tras recargar');
  await lib.locator('[data-action="open-library"]').click();
  await lib.waitForSelector('#libraryDialog[open]');
  const activeName = (await lib.locator('.library-row [aria-current="true"] .library-name').innerText()).trim();
  assert.equal(activeName, 'H&S Inmobiliaria', 'la cotización activa persiste');

  const tmp = path.join(root, 'tests/tmp');
  mkdirSync(tmp, { recursive: true });
  const [download] = await Promise.all([
    lib.waitForEvent('download'),
    lib.locator('[data-action="backup-library"]').click()
  ]);
  const backupPath = path.join(tmp, 'respaldo.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  assert.equal(backup.quotes.length, 3, 'el respaldo contiene las tres cotizaciones');
  assert.equal(backup.version, 1);

  while ((await lib.locator('.library-row').count()) > 1) {
    await lib.locator('.library-row').nth(1).locator('[data-action="delete-quote"]').click();
  }
  assert.equal(await lib.locator('.library-row').count(), 1);
  await lib.locator('[data-action="delete-quote"]').first().click();
  await lib.waitForFunction(() => document.querySelector('#toast').textContent.includes('al menos una'));
  assert.equal(await lib.locator('.library-row').count(), 1, 'la última cotización no se elimina');

  assert.deepEqual(libErrors, [], `errores en la biblioteca:\n${libErrors.join('\n')}`);
  await libContext.close();
  console.log('E2E biblioteca: OK');

  /* ---------- versión cliente ---------- */
  writeClientPage();
  await waitForServer(`${serverUrl}/c/_e2e/`);

  const clientContext = await browser.newContext();
  const page = await clientContext.newPage();
  const clientErrors = watch(page);

  await page.goto(`${serverUrl}/c/_e2e/`);
  await page.waitForSelector('body.ready', { timeout: 10000 });

  assert.equal(await page.locator('input, textarea, select, [contenteditable="true"]').count(), 0, 'el cliente no debe tener controles de edición');
  assert.equal(await page.getByText('Editar', { exact: true }).count(), 0, 'no debe aparecer “Editar”');
  assert.equal(await page.locator('[data-action="print"]').count(), 1, 'debe existir Exportar PDF');
  assert.match(await page.locator('[data-date]').innerText(), /27 de octubre de 2026/);
  assert.equal(await page.locator('[data-nav][href="#otros-trabajos"]').isHidden(), true, 'sin evidencia general no hay enlace');

  await page.locator('[data-action="play-video"]').first().click();
  await page.waitForSelector('.shot-frame video', { timeout: 5000 });
  assert.ok((await page.locator('.shot-frame video').first().getAttribute('src')), 'el video debe tener src');

  await page.locator('[data-action="lightbox"]').first().click();
  await page.waitForSelector('#lightbox:not([hidden])');
  await page.locator('.lb-close').click();
  assert.equal(await page.locator('#lightbox').isHidden(), true, 'el lightbox debe cerrarse');

  assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 0, 'el cliente no debe escribir en localStorage');
  assert.deepEqual(clientErrors, [], `errores en el cliente:\n${clientErrors.join('\n')}`);
  await clientContext.close();
  console.log('E2E cliente: OK');
} finally {
  await browser.close();
  server.kill();
  rmSync(path.join(root, 'docs/c/_e2e'), { recursive: true, force: true });
  rmSync(path.join(root, 'tests/tmp'), { recursive: true, force: true });
}
