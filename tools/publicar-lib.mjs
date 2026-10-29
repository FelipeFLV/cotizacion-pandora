import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  clientData,
  buildClientHtml,
  resolveSlug,
  validatePackage
} from '../supabase/functions/_shared/render.js';

export { clientData, buildClientHtml, resolveSlug, validatePackage };

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

const QUOTE_ID_RE = /name="pandora-quote-id" content="([^"]*)"/;
const LEGACY_PAGE_ID = 'q_legacy_hs';

const MEDIA_REASON = {
  blob: 'es un archivo temporal de esta sesión',
  'data-video': 'es un video incrustado',
  'data-image-size': 'es una imagen incrustada de más de 1.5 MB',
  scheme: 'usa un esquema no permitido',
  missing: 'no existe dentro de docs/'
};

export function validateRetiro(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== 'object') return ['El paquete no es un objeto JSON.'];
  if (pkg.kind !== 'pandora-retiro') errors.push('El paquete no es de tipo pandora-retiro.');
  if (pkg.version !== 1) errors.push('La versión del paquete no es compatible.');
  try {
    resolveSlug(pkg);
  } catch (error) {
    errors.push(error.message);
  }
  if (!pkg.quoteId) errors.push('El paquete de retiro no tiene identificador de cotización.');
  if (typeof pkg.generatedAt !== 'string' || !pkg.generatedAt || Number.isNaN(new Date(pkg.generatedAt).getTime())) {
    errors.push('Falta la fecha de generación del paquete.');
  }
  return errors;
}

export function readSiteBase(repoRoot) {
  const file = path.join(repoRoot, 'js', 'config.js');
  const source = readFileSync(file, 'utf8');
  const match = source.match(/P\.siteBase\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error('No se encontró P.siteBase en js/config.js.');
  return match[1].replace(/\/+$/, '');
}

export function pageUrl(siteBase, slug) {
  return `${String(siteBase).replace(/\/+$/, '')}/c/${slug}/`;
}

function existingQuoteId(file) {
  if (!existsSync(file)) return '';
  const match = readFileSync(file, 'utf8').match(QUOTE_ID_RE);
  return match ? match[1] : '';
}

export function prepareClient({ repoRoot, pkg, templatePath, base = '../../', force = false, outDir }) {
  const errors = validatePackage(pkg);
  if (errors.length) throw new Error(errors.join('\n'));

  const slug = resolveSlug(pkg);
  const dir = path.join(outDir || repoRoot, 'docs', 'c', slug);
  const file = path.join(dir, 'index.html');
  const quoteId = pkg.quote.id || slug;

  if (!force && existsSync(file)) {
    const current = existingQuoteId(file);
    if (current !== quoteId && current !== LEGACY_PAGE_ID) {
      throw new Error(`El slug "${slug}" ya pertenece a otra cotización. Usa otro slug o --force.`);
    }
  }

  const mediaErrors = P.validateMedia(pkg, {
    exists: (relative) => existsSync(path.join(repoRoot, relative))
  });
  if (mediaErrors.length) {
    const error = mediaErrors[0];
    if (error.reason === 'missing') {
      throw new Error(`No existe el medio "${error.title}": ${error.src}`);
    }
    throw new Error(`El medio "${error.title}" (${error.src}) ${MEDIA_REASON[error.reason] || 'no es válido'}.`);
  }

  const template = readFileSync(templatePath, 'utf8');
  const html = buildClientHtml({ template, pkg, base });
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, html);
  return { file, html };
}

export function retireClient({ repoRoot, pkg, force = false, dryRun = false }) {
  const slug = resolveSlug(pkg);
  const dir = path.join(repoRoot, 'docs', 'c', slug);
  if (!existsSync(dir)) throw new Error(`No existe la publicación "${slug}".`);

  if (!force) {
    const current = existingQuoteId(path.join(dir, 'index.html'));
    if (current !== pkg.quoteId && current !== LEGACY_PAGE_ID) {
      throw new Error(`El slug "${slug}" ya pertenece a otra cotización. Usa --force para retirarla igual.`);
    }
  }

  if (!dryRun) rmSync(dir, { recursive: true, force: true });
  return { dir };
}
