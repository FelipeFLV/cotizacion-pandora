import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { launch, watch } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrixUrl = pathToFileURL(path.join(root, 'index.html')).href;

const browser = await launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = watch(page);

  await page.goto(matrixUrl);
  await page.waitForSelector('body.ready', { timeout: 10000 });

  const logoWidth = await page.locator('.brand img').first().evaluate((img) => img.naturalWidth);
  assert.ok(logoWidth > 0, 'el logo debe cargar desde docs/assets');

  await page.locator('[data-action="toggle-edit"]').click();
  const client = page.locator('[data-text="meta.client"]').first();
  assert.ok((await client.count()) === 1, 'el nombre del cliente debe ser editable');
  await client.fill('Cliente Prueba');
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForSelector('body.ready');
  const saved = (await page.locator('[data-text="meta.client"]').first().innerText()).trim();
  assert.equal(saved, 'Cliente Prueba', 'el nombre editado debe persistir tras recargar');

  assert.deepEqual(errors, [], `errores en consola:\n${errors.join('\n')}`);
  await context.close();
  console.log('E2E matriz: OK');
} finally {
  await browser.close();
}
