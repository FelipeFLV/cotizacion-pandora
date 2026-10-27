import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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

const bank = P.seedEvidenceBank();
const MODES = ['service', 'general', 'both', 'none'];

function clientPackage(mode) {
  const quote = P.defaultQuote();
  quote.id = 'q_e2e';
  quote.meta.client = 'Cliente Prueba';
  quote.evidence = {
    mode,
    generalIds: { videos: [bank.videos[0].id], images: [bank.images[0].id] }
  };
  const payload = P.buildClientPayload(quote, { bank, now: new Date(2026, 9, 27, 10, 42) });
  return {
    slug: `_e2e-${mode}`,
    generatedAt: payload.generatedAt,
    quote: payload.quote,
    general: payload.general
  };
}

function writeClientPage(mode) {
  const template = readFileSync(path.join(root, 'tools/cliente.template.html'), 'utf8');
  const dir = path.join(root, 'docs/c', `_e2e-${mode}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'index.html'),
    buildClientHtml({ template, pkg: clientPackage(mode), base })
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

  await lib.locator('[data-action="close-library"]').click();
  await lib.locator('[data-action="toggle-edit"]').click();
  await lib.locator('[data-text="meta.client"]').first().fill('Nombre Temporal');
  await lib.waitForTimeout(700);
  await lib.locator('[data-action="open-library"]').click();
  await lib.waitForSelector('#libraryDialog[open]');
  await lib.setInputFiles('#libraryFile', backupPath);
  await lib.waitForFunction(() => document.querySelector('.library-row [aria-current="true"] .library-name').textContent === 'H&S Inmobiliaria');
  assert.equal((await lib.locator('[data-library-count]').innerText()).trim(), '3', 'importar restaura las tres');
  assert.ok(await lib.evaluate(() => localStorage.getItem('pandora.biblioteca.backup')), 'guarda el respaldo previo a importar');

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

  /* ---------- evidencias ---------- */
  const evContext = await browser.newContext();
  const ev = await evContext.newPage();
  const evErrors = watch(ev);
  ev.on('dialog', (dialog) => dialog.accept());

  await ev.goto(matrixUrl);
  await ev.waitForSelector('body.ready', { timeout: 10000 });
  await ev.locator('[data-action="open-evidence"]').click();
  await ev.waitForSelector('#evidenceDialog[open]');

  assert.equal(await ev.locator('.bank-row[data-bank-kind="videos"]').count(), 5, 'el banco arranca con 5 videos');
  assert.equal(await ev.locator('.bank-row[data-bank-kind="images"]').count(), 5, 'el banco arranca con 5 imágenes');
  assert.equal((await ev.locator('[data-bank-count]').innerText()).trim(), '10');

  await ev.locator('[data-mode="general"]').click();
  assert.equal(await ev.locator('[data-mode="general"]').getAttribute('aria-pressed'), 'true');

  await ev.locator('[data-action="select-all"][data-kind="videos"]').click();
  assert.equal(await ev.locator('[data-evidence-kind="videos"]:checked').count(), 5);
  assert.equal((await ev.locator('[data-evidence-count]').innerText()).trim(), '5');

  await ev.reload();
  await ev.waitForSelector('body.ready');
  await ev.locator('[data-action="open-evidence"]').click();
  await ev.waitForSelector('#evidenceDialog[open]');
  assert.equal(await ev.locator('[data-mode="general"]').getAttribute('aria-pressed'), 'true', 'el modo persiste');
  assert.equal(await ev.locator('[data-evidence-kind="videos"]:checked').count(), 5, 'la selección persiste');

  await ev.locator('[data-action="toggle-new-client"]').click();
  assert.equal(await ev.locator('[data-mode="service"]').getAttribute('aria-pressed'), 'true', 'el modo vuelve a servicio');
  assert.equal(await ev.locator('[data-evidence-kind="videos"]:checked').count(), 5, 'conserva la selección al volver');
  await ev.locator('[data-action="toggle-new-client"]').click();
  assert.equal(await ev.locator('[data-mode="general"]').getAttribute('aria-pressed'), 'true', 'vuelve a general');
  assert.equal(await ev.locator('[data-evidence-kind="videos"]:checked').count(), 5, 'no reinicia la selección');

  const removed = await ev.locator('.bank-row[data-bank-kind="videos"]').first().getAttribute('data-id');
  await ev.locator('[data-action="remove-bank"]').first().click();
  assert.equal(await ev.locator('.bank-row[data-bank-kind="videos"]').count(), 4, 'quitar reduce el banco');
  const selected = await ev.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('pandora.biblioteca.v1'));
    const active = lib.quotes.find((entry) => entry.id === lib.activeId);
    return active.quote.evidence.generalIds.videos;
  });
  assert.equal(selected.includes(removed), false, 'la selección ya no contiene la pieza quitada');
  assert.equal(selected.length, 4);

  assert.deepEqual(evErrors, [], `errores en evidencias:\n${evErrors.join('\n')}`);
  await evContext.close();
  console.log('E2E evidencias: OK');

  /* ---------- exportar cliente, historial y retiro ---------- */
  const pubContext = await browser.newContext({ acceptDownloads: true });
  const pub = await pubContext.newPage();
  const pubErrors = watch(pub);
  pub.on('dialog', (dialog) => dialog.accept());

  await pub.goto(matrixUrl);
  await pub.waitForSelector('body.ready', { timeout: 10000 });
  await pub.locator('[data-action="toggle-edit"]').click();
  await pub.locator('[data-text="meta.client"]').first().fill('Cliente 01');
  await pub.waitForTimeout(700);

  await pub.locator('[data-action="open-publish"]').click();
  await pub.waitForSelector('#publishDialog[open]');
  const firstUrl = await pub.locator('[data-publish-url]').getAttribute('href');
  assert.match(firstUrl, /^https:\/\/felipeflv\.github\.io\/cotizacion-pandora\/c\/[a-z0-9-]+\/$/, 'la URL usa la base y el slug');
  const slug = firstUrl.split('/c/')[1].replace(/\/$/, '');

  const pubTmp = path.join(root, 'tests/tmp');
  mkdirSync(pubTmp, { recursive: true });
  const [pkgDownload] = await Promise.all([
    pub.waitForEvent('download'),
    pub.locator('[data-action="download-package"]').click()
  ]);
  const pkgPath = path.join(pubTmp, 'cliente.json');
  await pkgDownload.saveAs(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.equal(pkg.kind, 'pandora-cliente');
  assert.equal(pkg.version, 1);
  assert.equal(pkg.slug, slug);
  assert.equal(pkg.quote.meta.client, 'Cliente 01');
  assert.equal(pkg.quote.meta.date, P.todayISO());
  assert.match(pkg.quote.meta.publishedUrl, /\/c\/[a-z0-9-]+\/$/);
  assert.ok(pkg.quote.blocks[0].videos.length >= 2, 'el modo servicio conserva sus videos');
  assert.equal(pkg.general.videos.length, 0, 'el modo servicio no incluye el banco');

  await pub.locator('[data-action="open-library"]').click();
  await pub.waitForSelector('#libraryDialog[open]');
  assert.match(await pub.locator('[data-action="open-history"]').innerText(), /\(1\)/, 'el primer export crea una versión');
  await pub.locator('[data-action="close-library"]').click();

  await pub.locator('[data-text="meta.client"]').first().fill('Cliente 01 bis');
  await pub.waitForTimeout(700);
  await pub.locator('[data-action="open-publish"]').click();
  await pub.waitForSelector('#publishDialog[open]');
  await Promise.all([
    pub.waitForEvent('download'),
    pub.locator('[data-action="download-package"]').click()
  ]);
  await pub.locator('[data-action="open-library"]').click();
  await pub.waitForSelector('#libraryDialog[open]');
  assert.match(await pub.locator('[data-action="open-history"]').innerText(), /\(2\)/, 'el segundo export suma otra versión');
  await pub.locator('[data-action="open-history"]').click();
  await pub.waitForSelector('#historyDialog[open]');
  assert.equal(await pub.locator('.history-row').count(), 2);
  await pub.locator('[data-action="restore-version"]').nth(1).click();
  await pub.waitForFunction(() => !document.querySelector('#historyDialog').open);
  assert.equal((await pub.locator('[data-text="meta.client"]').first().innerText()).trim(), 'Cliente 01', 'restaurar vuelve a la versión anterior');
  await pub.locator('[data-action="close-library"]').click();

  await pub.evaluate(() => {
    P.store.quote.blocks[0].videos[0].src = 'blob:http://x/y';
    P.store.save();
  });
  await pub.locator('[data-action="open-publish"]').click();
  await pub.waitForSelector('#publishDialog[open]');
  assert.equal(await pub.locator('#publishErrors').isVisible(), true, 'un blob bloquea la exportación');
  assert.equal(await pub.locator('[data-action="download-package"]').isDisabled(), true);
  await pub.locator('[data-action="close-publish"]').click();

  await pub.evaluate(() => {
    P.store.quote.evidence.mode = 'none';
    P.store.save();
  });
  await pub.locator('[data-action="open-publish"]').click();
  await pub.waitForSelector('#publishDialog[open]');
  assert.equal(await pub.locator('#publishErrors').isHidden(), true, 'ocultar la evidencia evita el bloqueo');
  assert.equal(await pub.locator('[data-action="download-package"]').isDisabled(), false);
  await pub.locator('[data-action="close-publish"]').click();

  await pub.evaluate(() => {
    P.store.quote.evidence = { mode: 'general', generalIds: { videos: ['e_missing'], images: [] } };
    P.store.save();
  });
  await pub.locator('[data-action="open-publish"]').click();
  await pub.waitForSelector('#publishDialog[open]');
  assert.equal(await pub.locator('#publishWarning').isVisible(), true, 'general sin piezas avisa');
  assert.equal((await pub.locator('[data-publish="mode"]').innerText()).trim(), 'Servicio', 'general sin piezas cae a servicio');
  await pub.locator('[data-action="close-publish"]').click();
  assert.equal(
    await pub.evaluate(() => P.store.quote.evidence.mode),
    'general',
    'abrir el diálogo no cambia el modo guardado'
  );

  await pub.locator('[data-action="open-library"]').click();
  await pub.waitForSelector('#libraryDialog[open]');
  const [retireDownload] = await Promise.all([
    pub.waitForEvent('download'),
    pub.locator('[data-action="retire-quote"]').first().click()
  ]);
  const retirePath = path.join(pubTmp, 'retiro.json');
  await retireDownload.saveAs(retirePath);
  const retire = JSON.parse(readFileSync(retirePath, 'utf8'));
  assert.equal(retire.kind, 'pandora-retiro');
  assert.equal(retire.version, 1);
  assert.equal(retire.slug, slug);
  assert.match(retire.quoteId, /^q_/);
  await pub.waitForFunction(() => document.querySelector('.status-pill').textContent === 'Retiro pendiente');
  assert.equal(await pub.locator('.library-row').count(), 1, 'la cotización sigue en la biblioteca');
  await pub.locator('[data-action="cancel-retire"]').click();
  await pub.waitForFunction(() => document.querySelector('.status-pill').textContent === 'Publicada');
  assert.equal(await pub.locator('[data-action="retire-quote"]').count(), 1, 'el retiro se puede regenerar');

  assert.deepEqual(pubErrors, [], `errores al exportar:\n${pubErrors.join('\n')}`);
  await pubContext.close();
  console.log('E2E exportación: OK');

  /* ---------- versión cliente ---------- */
  MODES.forEach(writeClientPage);
  await waitForServer(`${serverUrl}/c/_e2e-service/`);

  const clientContext = await browser.newContext();
  const page = await clientContext.newPage();
  const clientErrors = watch(page);

  await page.goto(`${serverUrl}/c/_e2e-service/`);
  await page.waitForSelector('body.ready', { timeout: 10000 });

  assert.equal(await page.locator('input, textarea, select, [contenteditable="true"]').count(), 0, 'el cliente no debe tener controles de edición');
  assert.equal(await page.getByText('Editar', { exact: true }).count(), 0, 'no debe aparecer “Editar”');
  assert.equal(await page.locator('[data-action="print"]').count(), 1, 'debe existir Exportar PDF');
  assert.match(await page.locator('[data-date]').innerText(), /27 de octubre de 2026/);

  const layout = {};
  for (const mode of MODES) {
    await page.goto(`${serverUrl}/c/_e2e-${mode}/`);
    await page.waitForSelector('body.ready');
    layout[mode] = {
      service: await page.locator('.section-work:not(.section-general)').count(),
      general: await page.locator('#otros-trabajos').count(),
      navEvidence: await page.locator('[data-nav][href="#evidencia"]').isHidden(),
      navGeneral: await page.locator('[data-nav][href="#otros-trabajos"]').isHidden()
    };
  }

  assert.deepEqual(layout.service, { service: 1, general: 0, navEvidence: false, navGeneral: true }, 'modo servicio');
  assert.deepEqual(layout.general, { service: 0, general: 1, navEvidence: true, navGeneral: false }, 'modo general');
  assert.deepEqual(layout.both, { service: 1, general: 1, navEvidence: false, navGeneral: false }, 'modo ambas');
  assert.deepEqual(layout.none, { service: 0, general: 0, navEvidence: true, navGeneral: true }, 'modo ocultar');

  await page.goto(`${serverUrl}/c/_e2e-general/`);
  await page.waitForSelector('body.ready');
  await page.locator('#otros-trabajos [data-action="play-video"]').first().click();
  await page.waitForSelector('#otros-trabajos .shot-frame video, #otros-trabajos .shot-frame iframe', { timeout: 5000 });
  await page.locator('#otros-trabajos [data-action="lightbox"]').first().click();
  await page.waitForSelector('#lightbox:not([hidden])');
  await page.locator('.lb-close').click();
  assert.equal(await page.locator('#lightbox').isHidden(), true, 'el lightbox general debe cerrarse');

  await page.goto(`${serverUrl}/c/_e2e-service/`);
  await page.waitForSelector('body.ready');
  await page.locator('[data-action="play-video"]').first().click();
  await page.waitForSelector('.shot-frame video', { timeout: 5000 });
  assert.ok((await page.locator('.shot-frame video').first().getAttribute('src')), 'el video debe tener src');
  await page.locator('[data-action="lightbox"]').first().click();
  await page.waitForSelector('#lightbox:not([hidden])');
  await page.locator('.lb-close').click();
  assert.equal(await page.locator('#lightbox').isHidden(), true, 'el lightbox debe cerrarse');

  await page.goto(`${serverUrl}/c/_e2e-none/`);
  await page.waitForSelector('body.ready');
  assert.equal(await page.evaluate(() => document.documentElement.innerHTML.includes('assets/media')), false, 'sin rutas de medios en el DOM');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__PANDORA__).includes('assets/media')), false, 'sin rutas de medios en el payload');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 0, 'el cliente no debe escribir en localStorage');

  assert.deepEqual(clientErrors, [], `errores en el cliente:\n${clientErrors.join('\n')}`);


  /* ---------- PDF ---------- */
  await page.goto(`${serverUrl}/c/_e2e-service/`);
  await page.waitForSelector('body.ready');
  await page.emulateMedia({ media: 'print' });
  const print = await page.evaluate(() => {
    const display = (selector) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).display : 'missing';
    };
    return {
      topbar: display('.topbar'),
      actions: display('.topbar-actions'),
      lightbox: display('.lightbox'),
      buttons: document.querySelector('[data-action="print"]').getClientRects().length > 0,
      brand: display('.print-brand'),
      footer: display('.print-foot')
    };
  });
  assert.equal(print.topbar, 'none', 'la barra superior se oculta al imprimir');
  assert.equal(print.actions, 'none', 'las acciones se ocultan al imprimir');
  assert.equal(print.lightbox, 'none', 'el lightbox se oculta al imprimir');
  assert.equal(print.buttons, false, 'el botón de PDF se oculta al imprimir');
  assert.notEqual(print.brand, 'none', 'la marca impresa es visible');
  assert.notEqual(print.footer, 'none', 'el pie impreso es visible');
  await page.emulateMedia({ media: 'screen' });
  console.log('E2E PDF: OK');

  /* ---------- responsive ---------- */
  const widths = [360, 390, 768, 1024, 1440];
  const respContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const resp = await respContext.newPage();
  const respErrors = watch(resp);
  await resp.goto(matrixUrl);
  await resp.waitForSelector('body.ready');
  await resp.locator('[data-action="toggle-edit"]').click();
  const longName = 'Cliente con un nombre largo de prueba 01 '.repeat(2).slice(0, 60).trim();
  await resp.locator('[data-text="meta.client"]').first().fill(longName);
  await resp.waitForTimeout(700);
  await resp.locator('[data-action="open-library"]').click();
  await resp.waitForSelector('#libraryDialog[open]');

  for (const width of widths) {
    await resp.setViewportSize({ width, height: 900 });
    await resp.waitForTimeout(120);
    const over = await resp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `la matriz desborda ${over}px a ${width}px con un nombre de 60 caracteres`);
  }
  await resp.locator('[data-action="close-library"]').click();

  for (const mode of ['service', 'general']) {
    await page.goto(`${serverUrl}/c/_e2e-${mode}/`);
    await page.waitForSelector('body.ready');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `el cliente (${mode}) desborda ${over}px a ${width}px`);
    }
  }

  assert.deepEqual(respErrors, [], `errores responsive:\n${respErrors.join('\n')}`);
  await respContext.close();
  console.log('E2E responsive: OK');

  /* ---------- publicación --dry-run ---------- */
  const fixture = path.join(root, 'tests/fixtures/cliente.json');
  const outDir = path.join(root, 'tests/tmp/pub');
  const dry = spawnSync(process.execPath, ['tools/publicar.mjs', fixture, '--dry-run', '--out', outDir], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(dry.status, 0, `el dry run falló:\n${dry.stderr}`);
  assert.match(dry.stdout, /tests\/tmp\/pub\/docs\/c\/demo\/index\.html/);
  assert.match(dry.stdout, /https:\/\/felipeflv\.github\.io\/cotizacion-pandora\/c\/demo\//);
  assert.equal(existsSync(path.join(outDir, 'docs/c/demo/index.html')), true, 'el dry run escribe la página');
  assert.equal(existsSync(path.join(root, 'docs/c/demo')), false, 'el dry run no toca docs/c');

  const invalid = path.join(root, 'tests/tmp/invalid.json');
  const invalidPkg = JSON.parse(readFileSync(fixture, 'utf8'));
  invalidPkg.slug = 'Demo!';
  writeFileSync(invalid, JSON.stringify(invalidPkg));
  const bad = spawnSync(process.execPath, ['tools/publicar.mjs', invalid, '--dry-run', '--out', outDir], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(bad.status, 1, 'un slug inválido aborta');
  assert.match(bad.stderr, /slug/i);

  const missing = path.join(root, 'tests/tmp/missing.json');
  const missingPkg = JSON.parse(readFileSync(fixture, 'utf8'));
  missingPkg.quote.blocks[0].images[0].src = 'assets/media/nope.png';
  writeFileSync(missing, JSON.stringify(missingPkg));
  const absent = spawnSync(process.execPath, ['tools/publicar.mjs', missing, '--dry-run', '--out', outDir], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(absent.status, 1, 'un medio inexistente aborta');
  assert.match(absent.stderr, /nope\.png/);

  const badPoster = path.join(root, 'tests/tmp/poster.json');
  const posterPkg = JSON.parse(readFileSync(fixture, 'utf8'));
  posterPkg.quote.blocks[0].videos[0].poster = 'assets/media/nope-poster.jpg';
  writeFileSync(badPoster, JSON.stringify(posterPkg));
  const poster = spawnSync(process.execPath, ['tools/publicar.mjs', badPoster, '--dry-run', '--out', outDir], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(poster.status, 1, 'una portada inexistente aborta');
  assert.match(poster.stderr, /portada.*nope-poster\.jpg/);
  console.log('E2E publicación: OK');

  await clientContext.close();
  console.log('E2E cliente: OK');
} finally {
  await browser.close();
  server.kill();
  MODES.forEach((mode) => rmSync(path.join(root, 'docs/c', `_e2e-${mode}`), { recursive: true, force: true }));
  rmSync(path.join(root, 'tests/tmp'), { recursive: true, force: true });
}
