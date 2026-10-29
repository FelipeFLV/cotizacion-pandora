/* Núcleo de publicación, independiente de Deno: recibe Supabase, GitHub y la
   plantilla ya construidos. La Edge Function solo envuelve HTTP y auditoría. */
import { mediaRefs, slugify } from './render.js';
import { planPublish } from './plan.js';
import { HttpError } from './http.js';

export function extensionFor(mime) {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

export function base64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

export async function generalEvidence(supabase, quote, ownerId) {
  const ids = (quote.evidence && quote.evidence.generalIds) || { videos: [], images: [] };
  const videos = ids.videos || [];
  const images = ids.images || [];
  if (!videos.length && !images.length) return { videos: [], images: [] };

  const { data, error } = await supabase
    .from('bank_items')
    .select('*')
    .in('id', videos.concat(images))
    .eq('owner_id', ownerId);
  if (error) throw new HttpError(500, 'No se pudo leer el banco de evidencias.');

  const byId = new Map((data || []).map((item) => [item.id, item]));
  const missing = videos.concat(images).filter((id) => !byId.has(id));
  if (missing.length) {
    throw new HttpError(400, 'Una evidencia general del banco ya no existe. Desmárcala y vuelve a publicar.');
  }

  const piece = (item) => ({
    title: item.title,
    src: item.media_id ? `media:${item.media_id}` : item.url,
    poster: ''
  });
  return {
    videos: videos.map((id) => byId.get(id)).map(piece),
    images: images.map((id) => byId.get(id)).map(piece)
  };
}

export async function reserveSlug(supabase, quoteId, row, quote) {
  if (row.slug) return row.slug;
  const client = (quote.meta && quote.meta.client) || '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${slugify(client)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: clash } = await supabase.from('quotes').select('id').eq('slug', candidate).maybeSingle();
    if (clash) continue;
    const { error } = await supabase.from('quotes').update({ slug: candidate }).eq('id', quoteId);
    if (!error) return candidate;
  }
  throw new HttpError(409, 'No se pudo reservar una URL para esta cotización.');
}

export async function publishQuote(options) {
  const opts = options || {};
  const { supabase, github, template, siteBase, user, quoteId } = opts;
  const now = opts.now || new Date().toISOString();

  if (!quoteId) throw new HttpError(400, 'Falta la cotización que se quiere publicar.');

  const { data: row, error: rowError } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (rowError || !row) throw new HttpError(404, 'No existe la cotización.');
  if (row.owner_id !== user.id) throw new HttpError(403, 'Esa cotización no te pertenece.');
  if (row.is_template) throw new HttpError(400, 'Una plantilla no se puede publicar: crea un cliente a partir de ella.');
  if (row.archived_at) throw new HttpError(400, 'La cotización está archivada.');

  const quote = Object.assign({}, row.data || {});
  quote.id = row.id;
  quote.meta = quote.meta || {};

  const slug = await reserveSlug(supabase, quoteId, row, quote);
  const general = await generalEvidence(supabase, quote, user.id);
  const ids = mediaRefs(quote, general);

  const assetPaths = {};
  const assets = {};
  if (ids.length) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .in('id', ids)
      .eq('owner_id', user.id);
    if (mediaError) throw new HttpError(500, 'No se pudieron leer las imágenes.');

    for (const media of mediaRows || []) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from('drafts')
        .download(media.storage_path);
      if (downloadError || !blob) {
        throw new HttpError(400, 'Una evidencia usa una imagen que no se pudo descargar. Vuelve a subirla.');
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assetPaths[media.id] = `${media.id}.${extensionFor(media.mime)}`;
      assets[media.id] = base64(bytes);
    }

    const missing = ids.filter((id) => !assetPaths[id]);
    if (missing.length) {
      throw new HttpError(400, 'Una evidencia usa una imagen que ya no existe. Vuelve a subirla.');
    }
  }

  let plan;
  let commit;
  try {
    const existingPaths = await github.listPaths(`docs/assets/c/${slug}/`);
    plan = planPublish({
      quote,
      general,
      slug,
      siteBase,
      generatedAt: now,
      template,
      assetPaths,
      assets,
      existingPaths
    });
    commit = await github.commit({
      message: `Publicar ${slug}`,
      files: plan.files,
      deletions: plan.deletions
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error && error.message ? error.message : 'No se pudo preparar la publicación.');
  }

  quote.meta = Object.assign({}, quote.meta, {
    slug,
    publishedUrl: plan.url,
    publishedAt: now,
    isDraft: false
  });

  const { error: updateError } = await supabase
    .from('quotes')
    .update({
      status: 'published',
      slug,
      published_url: plan.url,
      published_at: now,
      retired_at: null,
      data: quote
    })
    .eq('id', quoteId);
  if (updateError) throw new HttpError(500, 'Se publicó en GitHub, pero no se pudo marcar la cotización.');

  await supabase.from('quote_versions').insert({
    quote_id: quoteId,
    owner_id: user.id,
    data: quote,
    label: 'Publicación',
    published: true
  });

  return { url: plan.url, commit: commit.sha, slug, version: 1 };
}
