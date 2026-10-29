/* Renderizador compartido por Node, el panel y la Edge Function.
   Sin imports de Node ni de Deno: solo JavaScript estándar. */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MEDIA_RE = /^media:([A-Za-z0-9_-]{1,64})$/;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function dateLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fillTokens(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (values[key] == null ? '' : values[key]));
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
  return fillTokens(template, {
    TITLE: escapeHtml(`Propuesta · ${quote.meta.client || 'Pandora Marketing'}`),
    DESCRIPTION: escapeHtml('Propuesta de Pandora Marketing: alcance, evidencia e inversión.'),
    QUOTE_ID: escapeHtml(quote.id || pkg.slug),
    GENERATED_AT: escapeHtml(pkg.generatedAt || ''),
    DATE_ISO: escapeHtml(date),
    DATE_LABEL: escapeHtml(dateLabel(date)),
    BASE: base || '../../',
    DATA: clientData(quote, pkg.general, pkg.generatedAt)
  });
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

  if (typeof pkg.generatedAt !== 'string' || !pkg.generatedAt || Number.isNaN(new Date(pkg.generatedAt).getTime())) {
    errors.push('Falta la fecha de generación del paquete.');
  }

  return errors;
}

export function slugify(text) {
  const base = String(text == null ? '' : text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'cliente';
}

export function uniqueSlug(text, suffix) {
  const tail = suffix || Math.random().toString(36).slice(2, 6);
  return `${slugify(text)}-${tail}`;
}

function piecesOf(quote, general) {
  const pieces = [];
  (quote && Array.isArray(quote.blocks) ? quote.blocks : []).forEach((block) => {
    (block.videos || []).forEach((item) => pieces.push(item));
    (block.images || []).forEach((item) => pieces.push(item));
  });
  const bank = general || {};
  (bank.videos || []).forEach((item) => pieces.push(item));
  (bank.images || []).forEach((item) => pieces.push(item));
  return pieces;
}

export function mediaRefs(quote, general) {
  const ids = new Set();
  piecesOf(quote, general).forEach((piece) => {
    [piece && piece.src, piece && piece.poster].forEach((value) => {
      const match = String(value || '').match(MEDIA_RE);
      if (match) ids.add(match[1]);
    });
  });
  return Array.from(ids);
}

function rewriteRefs(list, map) {
  return (list || []).map((piece) => {
    const next = Object.assign({}, piece);
    ['src', 'poster'].forEach((field) => {
      const match = String(next[field] || '').match(MEDIA_RE);
      if (match && Object.prototype.hasOwnProperty.call(map, match[1])) {
        next[field] = map[match[1]];
      }
    });
    return next;
  });
}

export function applyMediaMap(quote, general, map) {
  const budget = map || {};
  const nextQuote = JSON.parse(JSON.stringify(quote || {}));
  (nextQuote.blocks || []).forEach((block) => {
    block.videos = rewriteRefs(block.videos, budget);
    block.images = rewriteRefs(block.images, budget);
  });
  const nextGeneral = JSON.parse(JSON.stringify(general || { videos: [], images: [] }));
  nextGeneral.videos = rewriteRefs(nextGeneral.videos, budget);
  nextGeneral.images = rewriteRefs(nextGeneral.images, budget);
  return { quote: nextQuote, general: nextGeneral };
}

export function isMediaRef(value) {
  return MEDIA_RE.test(String(value || ''));
}
