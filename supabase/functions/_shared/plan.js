/* Plan de publicación: valida la cotización, sustituye medios privados por
   rutas públicas y calcula los archivos y borrados de un solo commit. */
import {
  applyMediaMap,
  buildClientHtml,
  resolveSlug,
  validatePackage
} from './render.js';

const MEDIA_RE = /^media:([A-Za-z0-9_-]{1,64})$/;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d{6,})/;
const LEGACY_VIDEO_RE = /^assets\/[\w./-]+\.(mp4|webm|mov)$/i;
const UNSAFE_RE = /^(?:blob|file|javascript|vbscript|data):/i;
const ABSOLUTE_RE = /^https?:\/\//i;

function piecesOf(quote, general) {
  const out = [];
  ((quote && quote.blocks) || []).forEach((block) => {
    (block.videos || []).forEach((piece) => out.push({ piece, kind: 'video' }));
    (block.images || []).forEach((piece) => out.push({ piece, kind: 'image' }));
  });
  const bank = general || {};
  (bank.videos || []).forEach((piece) => out.push({ piece, kind: 'video' }));
  (bank.images || []).forEach((piece) => out.push({ piece, kind: 'image' }));
  return out;
}

function filenameOf(value) {
  const raw = typeof value === 'string' ? value : value && (value.path || value.filename);
  const name = String(raw == null ? '' : raw);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) {
    throw new Error(`Nombre de archivo no válido: "${name}".`);
  }
  return name;
}

function labelOf(piece) {
  return String((piece && piece.title) || 'sin título');
}

function checkValue(value, kind, field, piece, assetPaths) {
  const src = String(value == null ? '' : value).trim();
  if (!src) return;
  const title = labelOf(piece);

  if (UNSAFE_RE.test(src)) {
    throw new Error(`La evidencia "${title}" usa un esquema no permitido.`);
  }

  const media = src.match(MEDIA_RE);
  if (media) {
    if (!assetPaths || !Object.prototype.hasOwnProperty.call(assetPaths, media[1])) {
      throw new Error(`La evidencia "${title}" usa un archivo que no se pudo descargar.`);
    }
    return;
  }

  if (/^assets\//.test(src)) {
    if (src.includes('..') || src.includes('//') || src.includes('\\')) {
      throw new Error(`La evidencia "${title}" usa una ruta no permitida.`);
    }
    if (kind === 'video' && field === 'src' && !LEGACY_VIDEO_RE.test(src)) {
      throw new Error(`El video "${title}" debe ser un enlace de YouTube o Vimeo.`);
    }
    return;
  }

  if (ABSOLUTE_RE.test(src)) {
    if (kind === 'video' && field === 'src' && !YOUTUBE_RE.test(src) && !VIMEO_RE.test(src)) {
      throw new Error(`El video "${title}" debe ser un enlace de YouTube o Vimeo.`);
    }
    return;
  }

  throw new Error(`La evidencia "${title}" usa una dirección no permitida.`);
}

export function planPublish(options) {
  const opts = options || {};
  if (opts.isTemplate) {
    throw new Error('Una plantilla no se puede publicar: crea un cliente a partir de ella.');
  }
  const quote = opts.quote;
  const general = opts.general || { videos: [], images: [] };
  const slug = resolveSlug({ slug: opts.slug });
  const siteBase = String(opts.siteBase || '').replace(/\/+$/, '');
  const template = opts.template;
  const assetPaths = opts.assetPaths || {};
  const assets = opts.assets || {};
  const existingPaths = opts.existingPaths || [];

  if (!siteBase) throw new Error('Falta la URL del sitio.');
  if (typeof template !== 'string' || !template) throw new Error('Falta la plantilla de la página cliente.');

  piecesOf(quote, general).forEach(({ piece, kind }) => {
    checkValue(piece && piece.src, kind, 'src', piece, assetPaths);
    checkValue(piece && piece.poster, 'image', 'poster', piece, assetPaths);
  });

  const map = {};
  Object.keys(assetPaths).forEach((id) => {
    map[id] = `assets/c/${slug}/${filenameOf(assetPaths[id])}`;
  });

  const resolved = applyMediaMap(quote, general, map);
  const url = `${siteBase}/c/${slug}/`;
  const meta = Object.assign({}, resolved.quote.meta, {
    slug,
    publishedUrl: url,
    isDraft: false
  });
  const clientQuote = Object.assign({}, resolved.quote, { meta });
  const pkg = {
    kind: 'pandora-cliente',
    version: 1,
    slug,
    generatedAt: opts.generatedAt,
    quote: clientQuote,
    general: resolved.general
  };

  const errors = validatePackage(pkg);
  if (errors.length) throw new Error(errors.join('\n'));

  const html = buildClientHtml({ template, pkg, base: '../../' });
  const files = [{ path: `docs/c/${slug}/index.html`, content: html, encoding: 'utf8' }];

  Object.keys(assetPaths).forEach((id) => {
    const value = assetPaths[id];
    const content = typeof value === 'object' && value
      ? value.base64 || value.content || ''
      : assets[id] || '';
    files.push({
      path: `docs/assets/c/${slug}/${filenameOf(value)}`,
      content,
      encoding: 'base64'
    });
  });

  const prefix = `docs/assets/c/${slug}/`;
  const keep = new Set(files.filter((file) => file.path.startsWith(prefix)).map((file) => file.path));
  const deletions = existingPaths
    .filter((path) => String(path).startsWith(prefix) && !keep.has(path))
    .sort();

  return { html, files, deletions, url };
}
