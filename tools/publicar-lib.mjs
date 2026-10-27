import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const QUOTE_ID_RE = /name="pandora-quote-id" content="([^"]*)"/;
const LEGACY_PAGE_ID = 'q_legacy_hs';

const MEDIA_REASON = {
  blob: 'es un archivo temporal de esta sesión',
  'data-video': 'es un video incrustado',
  'data-image-size': 'es una imagen incrustada de más de 1.5 MB',
  scheme: 'usa un esquema no permitido',
  missing: 'no existe dentro de docs/'
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fill(template, token, value) {
  return template.split(`{{${token}}}`).join(value);
}

export function clientData(quote, general, generatedAt) {
  return JSON.stringify({
    quote,
    general: general || { videos: [], images: [] },
    meta: { generatedAt: generatedAt || '' }
  })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildClientHtml({ template, pkg, base }) {
  const quote = pkg.quote;
  const date = quote.meta.date || '';
  let html = template;
  html = fill(html, 'TITLE', escapeHtml(`Propuesta · ${quote.meta.client || 'Pandora Marketing'}`));
  html = fill(html, 'DESCRIPTION', escapeHtml('Propuesta de Pandora Marketing: alcance, evidencia e inversión.'));
  html = fill(html, 'QUOTE_ID', escapeHtml(quote.id || pkg.slug));
  html = fill(html, 'GENERATED_AT', escapeHtml(pkg.generatedAt || ''));
  html = fill(html, 'DATE_ISO', escapeHtml(date));
  html = fill(html, 'DATE_LABEL', escapeHtml(P.dateLabel(date)));
  html = fill(html, 'BASE', base);
  html = fill(html, 'DATA', clientData(quote, pkg.general, pkg.generatedAt));
  return html;
}

export function resolveSlug(pkg) {
  const slug = String((pkg && (pkg.slug || (pkg.quote && pkg.quote.meta && pkg.quote.meta.slug))) || '');
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Slug inválido: "${slug}". Usa minúsculas, números y guiones (2 a 64 caracteres).`);
  }
  return slug;
}

export function validatePackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== 'object') return ['El paquete no es un objeto JSON.'];
  if (pkg.kind !== 'pandora-cliente') errors.push('El paquete no es de tipo pandora-cliente.');

  const quote = pkg.quote;
  if (!quote || typeof quote !== 'object') {
    errors.push('Falta la cotización.');
  } else {
    if (!quote.meta || !String(quote.meta.client || '').trim()) errors.push('La cotización no tiene cliente.');
    if (!Array.isArray(quote.blocks) || !quote.blocks.length) errors.push('La cotización no tiene servicios.');
    if (!quote.id) errors.push('La cotización no tiene identificador.');
  }

  if (pkg.version !== 1) errors.push('La versión del paquete no es compatible.');

  try {
    resolveSlug(pkg);
  } catch (error) {
    errors.push(error.message);
  }

  if (!pkg.generatedAt || Number.isNaN(new Date(pkg.generatedAt).getTime())) {
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

  const current = existingQuoteId(file);
  if (current && current !== quoteId && current !== LEGACY_PAGE_ID && !force) {
    throw new Error(`El slug "${slug}" ya pertenece a otra cotización. Usa otro slug o --force.`);
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

  const current = existingQuoteId(path.join(dir, 'index.html'));
  if (current && pkg.quoteId && current !== pkg.quoteId && current !== LEGACY_PAGE_ID && !force) {
    throw new Error(`El slug "${slug}" ya pertenece a otra cotización. Usa --force para retirarla igual.`);
  }

  if (!dryRun) rmSync(dir, { recursive: true, force: true });
  return { dir };
}
