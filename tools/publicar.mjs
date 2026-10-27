#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pageUrl,
  prepareClient,
  readSiteBase,
  retireClient,
  validatePackage,
  validateRetiro
} from './publicar-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(repoRoot, 'tools', 'cliente.template.html');

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { file: '', dryRun: false, noPush: false, force: false, open: false, outDir: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-push') options.noPush = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--open') options.open = true;
    else if (arg === '--out') {
      index += 1;
      if (!argv[index]) fail('Falta la carpeta después de --out.');
      options.outDir = path.resolve(argv[index]);
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    } else {
      fail(`Argumento no reconocido: ${arg}`);
    }
  }
  return options;
}

function git(args) {
  return spawnSync('git', args, { cwd: repoRoot, stdio: 'inherit' });
}

function commitAndPush(relPaths, message, skipPush) {
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  const add = git(['add', '-A', '--', ...paths]);
  if (add.status !== 0) fail('git add falló.');

  const staged = spawnSync('git', ['diff', '--cached', '--quiet', '--', ...paths], { cwd: repoRoot });
  if (staged.status !== 0) {
    const commit = git(['commit', '-m', message, '--', ...paths]);
    if (commit.status !== 0) fail('git commit falló.');
  } else {
    console.log('Sin cambios que publicar.');
  }

  if (!skipPush) {
    const push = git(['push']);
    if (push.status !== 0) fail('git push falló. Revisa tu conexión o los permisos del repo.');
  }
}

const options = parseArgs(process.argv.slice(2));
const file = options.file ? path.resolve(options.file) : '';
if (!file) fail('Uso: node tools/publicar.mjs <paquete.json> [--dry-run] [--no-push] [--force] [--open] [--out <carpeta>]');
if (!existsSync(file)) fail(`No existe el paquete: ${file}`);

let pkg;
try {
  pkg = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  fail(`No se pudo leer el JSON: ${error.message}`);
}

const isRetiro = pkg && pkg.kind === 'pandora-retiro';
const siteBase = readSiteBase(repoRoot);
const url = pkg && pkg.slug ? pageUrl(siteBase, pkg.slug) : '';

if (isRetiro) {
  const retiroErrors = validateRetiro(pkg);
  if (retiroErrors.length) fail(retiroErrors.join('\n'));
  if (options.outDir) fail('--out no aplica a un paquete de retiro; usa --dry-run.');
  const message = `Retirar ${pkg.client || pkg.slug} — ${pkg.generatedAt.slice(0, 10)}`;
  const { dir } = retireClient({
    repoRoot,
    pkg,
    force: options.force,
    dryRun: options.dryRun
  });

  if (options.dryRun) {
    console.log(`Retiro simulado: se quitaría ${dir}`);
  } else {
    const relPath = path.relative(repoRoot, dir);
    commitAndPush(relPath, message, options.noPush);
    console.log('Publicación retirada.');
  }

  console.log(`La URL deja de existir: ${url}`);
  process.exit(0);
}

const errors = validatePackage(pkg);
if (errors.length) fail(errors.join('\n'));

const { file: target } = prepareClient({
  repoRoot,
  pkg,
  templatePath,
  force: options.force,
  outDir: options.outDir || repoRoot
});

const skipGit = options.dryRun || Boolean(options.outDir);
if (skipGit) {
  console.log(`Página escrita en ${target}`);
} else {
  const relPath = path.relative(repoRoot, target);
  const message = `Publicar ${pkg.quote.meta.client} — ${pkg.quote.meta.date || new Date().toISOString().slice(0, 10)}`;
  commitAndPush([relPath, 'docs/assets'], message, options.noPush);
  console.log('Publicación actualizada.');
}

console.log(`URL: ${url}`);
if (!skipGit) {
  const copied = spawnSync('pbcopy', { input: url });
  if (copied.status === 0) console.log('URL copiada al portapapeles.');
  if (options.open) {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    console.log('GitHub Pages puede tardar un minuto en reflejar los cambios.');
  }
}
