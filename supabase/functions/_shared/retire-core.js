/* Núcleo del retiro, independiente de Deno: borra solo la página del slug y
   conserva el borrador, los medios privados y el historial. */
import { HttpError } from './http.js';
import { planRetire, quoteIdFromHtml } from './retire-plan.js';

export async function retireQuote(options) {
  const opts = options || {};
  const { supabase, github, user, quoteId, siteBase } = opts;
  const now = opts.now || new Date().toISOString();

  if (!quoteId) throw new HttpError(400, 'Falta la cotización que se quiere retirar.');

  const { data: row, error } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (error || !row) throw new HttpError(404, 'No existe la cotización.');
  if (row.owner_id !== user.id) throw new HttpError(403, 'Esa cotización no te pertenece.');
  if (row.is_template) throw new HttpError(400, 'Una plantilla no se puede retirar.');
  if (!row.slug) throw new HttpError(400, 'Esta cotización nunca se publicó.');

  const existingPaths = await github.listPaths('docs/');
  const plan = planRetire({ slug: row.slug, siteBase, existingPaths });

  const pagePath = `docs/c/${row.slug}/index.html`;
  if (existingPaths.includes(pagePath)) {
    const html = await github.readFile(pagePath);
    const publishedId = quoteIdFromHtml(html);
    if (publishedId && publishedId !== row.id) {
      throw new HttpError(409, 'La página publicada no corresponde a esta cotización.');
    }
  }

  if (plan.deletions.length) {
    await github.commit({
      message: `Retirar ${row.slug}`,
      files: [],
      deletions: plan.deletions
    });
  }

  const data = Object.assign({}, row.data || {});
  data.meta = Object.assign({}, data.meta || {}, { retiredAt: now, isDraft: false });

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ status: 'retired', retired_at: now, data })
    .eq('id', quoteId);
  if (updateError) throw new HttpError(500, 'Se borró la página, pero no se pudo marcar la cotización.');

  return { ok: true, url: plan.url, deletions: plan.deletions.length };
}
