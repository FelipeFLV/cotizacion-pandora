/* Plan de retiro: borra únicamente la página y las imágenes del slug indicado. */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const QUOTE_ID_RE = /name="pandora-quote-id"\s+content="([^"]*)"/;

export function quoteIdFromHtml(html) {
  const match = String(html == null ? '' : html).match(QUOTE_ID_RE);
  return match ? match[1] : '';
}

export function planRetire(options) {
  const opts = options || {};
  const slug = String(opts.slug == null ? '' : opts.slug);
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Slug inválido: "${slug}".`);
  }

  const siteBase = String(opts.siteBase || '').replace(/\/+$/, '');
  if (!siteBase) throw new Error('Falta la URL del sitio.');

  const roots = [`docs/c/${slug}/`, `docs/assets/c/${slug}/`];
  const deletions = (opts.existingPaths || [])
    .map((path) => String(path == null ? '' : path))
    .filter((path) => roots.some((root) => path.startsWith(root)))
    .sort();

  return { deletions, url: `${siteBase}/c/${slug}/` };
}
