import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pageUrl,
  prepareClient,
  readSiteBase,
  resolveSlug,
  retireClient,
  validatePackage
} from '../tools/publicar-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(here, '..', 'tools', 'cliente.template.html');
const fixture = (name) => path.join(here, 'fixtures', name);

function loadPackage(name) {
  return JSON.parse(readFileSync(fixture(name), 'utf8'));
}

function tempRepo() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'pandora-'));
  mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'js'), { recursive: true });
  writeFileSync(
    path.join(repoRoot, 'js/config.js'),
    "window.P = window.P || {};\nwindow.P.siteBase = 'https://example.test/site';\n"
  );
  return repoRoot;
}

function touchAssets(repoRoot, pkg) {
  const pieces = [
    ...(pkg.quote.blocks || []).flatMap((block) => [...(block.videos || []), ...(block.images || [])]),
    ...(pkg.general.videos || []),
    ...(pkg.general.images || [])
  ];
  pieces.forEach((piece) => {
    if (!piece.src || !piece.src.startsWith('assets/')) return;
    const target = path.join(repoRoot, 'docs', piece.src);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, '');
  });
}

test('validates the package shape', () => {
  const pkg = loadPackage('cliente.json');
  assert.deepEqual(validatePackage(pkg), []);

  assert.match(validatePackage({ ...pkg, kind: 'otro' }).join(' '), /pandora-cliente/);
  assert.match(validatePackage({ ...pkg, version: 2 }).join(' '), /versión/i);
  assert.match(validatePackage({ ...pkg, quote: { ...pkg.quote, blocks: [] } }).join(' '), /servicio/i);
  assert.match(validatePackage({ ...pkg, slug: 'Demo!' }).join(' '), /slug/i);
  assert.match(validatePackage({ ...pkg, generatedAt: 'ayer' }).join(' '), /fecha/i);
});

test('resolves and rejects slugs', () => {
  const pkg = loadPackage('cliente.json');
  assert.equal(resolveSlug(pkg), 'demo');
  assert.equal(resolveSlug({ ...pkg, slug: '', quote: { ...pkg.quote, meta: { ...pkg.quote.meta, slug: 'otro-slug' } } }), 'otro-slug');
  assert.throws(() => resolveSlug({ ...pkg, slug: '-mal' }), /slug/i);
  assert.throws(() => resolveSlug({ ...pkg, slug: 'a' }), /slug/i);
});

test('reads the site base and builds the page url', () => {
  const repoRoot = tempRepo();
  assert.equal(readSiteBase(repoRoot), 'https://example.test/site');
  assert.equal(pageUrl('https://example.test/site/', 'demo'), 'https://example.test/site/c/demo/');
});

test('builds docs/c/<slug>/index.html with quote id', () => {
  const repoRoot = tempRepo();
  const pkg = loadPackage('cliente.json');
  touchAssets(repoRoot, pkg);

  const { file, html } = prepareClient({ repoRoot, pkg, templatePath, outDir: repoRoot });
  assert.equal(file, path.join(repoRoot, 'docs', 'c', 'demo', 'index.html'));
  assert.equal(readFileSync(file, 'utf8'), html);
  assert.match(html, /pandora-quote-id" content="q_test"/);
  assert.match(html, /href="..\/..\/app\/app.css"/);
});

test('collision with another quote id throws', () => {
  const repoRoot = tempRepo();
  const pkg = loadPackage('cliente.json');
  touchAssets(repoRoot, pkg);
  mkdirSync(path.join(repoRoot, 'docs/c/demo'), { recursive: true });
  writeFileSync(
    path.join(repoRoot, 'docs/c/demo/index.html'),
    '<meta name="pandora-quote-id" content="q_other">'
  );

  assert.throws(() => prepareClient({ repoRoot, pkg, templatePath }), /otra cotización/);

  const { file } = prepareClient({ repoRoot, pkg, templatePath, force: true });
  assert.match(readFileSync(file, 'utf8'), /content="q_test"/);
});

test('missing asset throws with title and path', () => {
  const repoRoot = tempRepo();
  const pkg = loadPackage('cliente.json');
  touchAssets(repoRoot, pkg);
  pkg.quote.blocks[0].images[0].src = 'assets/media/nope.png';

  assert.throws(
    () => prepareClient({ repoRoot, pkg, templatePath }),
    /No existe el medio .*nope\.png/
  );
});

test('unsafe media is rejected by the shared rules', () => {
  const repoRoot = tempRepo();
  const pkg = loadPackage('cliente.json');
  touchAssets(repoRoot, pkg);
  pkg.quote.blocks[0].videos[0].src = 'blob:http://x/y';

  assert.throws(() => prepareClient({ repoRoot, pkg, templatePath }), /temporal|blob/i);
});

test('retire removes the folder only for the same quote id', () => {
  const repoRoot = tempRepo();
  const pkg = loadPackage('cliente.json');
  touchAssets(repoRoot, pkg);
  prepareClient({ repoRoot, pkg, templatePath });

  const retiro = loadPackage('retiro.json');
  assert.throws(
    () => retireClient({ repoRoot, pkg: { ...retiro, quoteId: 'q_other' } }),
    /otra cotización/
  );

  const dry = retireClient({ repoRoot, pkg: retiro, dryRun: true });
  assert.equal(dry.dir, path.join(repoRoot, 'docs/c/demo'));
  assert.equal(existsSync(dry.dir), true, 'el dry run no borra');

  retireClient({ repoRoot, pkg: retiro });
  assert.equal(existsSync(path.join(repoRoot, 'docs/c/demo')), false);
});

test('retiring a slug that does not exist throws', () => {
  const repoRoot = tempRepo();
  assert.throws(() => retireClient({ repoRoot, pkg: loadPackage('retiro.json') }), /no existe/i);
});
