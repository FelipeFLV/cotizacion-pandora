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
}
