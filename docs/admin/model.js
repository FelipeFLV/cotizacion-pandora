/* Puente entre la biblioteca de la matriz (respaldo JSON) y las filas de Supabase.
   Sin red: solo transforma datos. */
(function (root) {
  'use strict';

  const P = root.P;
  const PADMIN = (root.PADMIN = root.PADMIN || {});

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uuid() {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 36; i += 1) {
      if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
      else if (i === 14) out += '4';
      else if (i === 19) out += hex[(Math.random() * 4 | 0) + 8];
      else out += hex[Math.random() * 16 | 0];
    }
    return out;
  }

  function todayISO() {
    return P && typeof P.todayISO === 'function'
      ? P.todayISO()
      : new Date().toISOString().slice(0, 10);
  }

  function isAbsolute(value) {
    return /^https?:\/\//i.test(String(value || ''));
  }

  function quoteStatus(meta) {
    if (meta.retiredAt) return 'retired';
    if (meta.publishedUrl) return 'published';
    return 'draft';
  }

  function cleanQuote(quote) {
    const out = clone(quote);
    out.meta = out.meta || {};
    delete out.meta.isDraft;
    return out;
  }

  function fromBackup(json, ownerId) {
    const data = json || {};
    if (data.version !== 1) {
      throw new Error('Versión de respaldo no compatible: se esperaba la versión 1.');
    }
    if (!Array.isArray(data.quotes) || !data.quotes.length) {
      throw new Error('El respaldo no trae cotizaciones.');
    }

    const quotes = [];
    const versions = [];

    data.quotes.forEach((entry, index) => {
      const quote = entry && entry.quote;
      const valid = quote
        && quote.meta
        && Array.isArray(quote.blocks)
        && quote.blocks.length
        && (entry.id || quote.id);
      if (!valid) {
        throw new Error(`Cotización incompleta en la posición ${index + 1}: falta cliente, bloques o identificador.`);
      }

      const meta = quote.meta;
      const id = uuid();
      quotes.push({
        id,
        owner_id: ownerId,
        slug: meta.slug || null,
        status: quoteStatus(meta),
        is_template: false,
        data: cleanQuote(quote),
        published_url: meta.publishedUrl || '',
        published_at: meta.publishedAt || null,
        retired_at: meta.retiredAt || null
      });

      (entry.versions || []).forEach((version) => {
        if (!version || !version.quote) return;
        versions.push({
          quote_id: id,
          owner_id: ownerId,
          data: cleanQuote(version.quote),
          label: version.label || '',
          published: true,
          created_at: version.at || new Date().toISOString()
        });
      });
    });

    const bank = [];
    const source = data.evidenceBank || {};
    ['videos', 'images'].forEach((kind) => {
      (source[kind] || []).forEach((piece) => {
        if (!piece || !piece.src) return;
        bank.push({
          owner_id: ownerId,
          kind: kind === 'videos' ? 'video' : 'image',
          title: piece.title || 'Sin título',
          source: isAbsolute(piece.src) ? 'url' : 'legacy',
          url: piece.src,
          media_id: null,
          service: piece.service || ''
        });
      });
    });

    return { quotes, versions, bank };
  }

  function newClientData(template) {
    const quote = clone(template || {});
    quote.meta = quote.meta || {};
    quote.meta.client = 'Cliente sin nombre';
    quote.meta.quoteNo = '';
    quote.meta.slug = '';
    quote.meta.generatedAt = '';
    quote.meta.publishedUrl = '';
    quote.meta.publishedAt = '';
    quote.meta.retiredAt = '';
    quote.meta.retireRequestedAt = '';
    quote.meta.isDraft = false;
    quote.meta.date = todayISO();
    quote.evidence = quote.evidence && quote.evidence.mode
      ? quote.evidence
      : { mode: 'service', generalIds: { videos: [], images: [] } };
    quote.blocks = quote.blocks || [];
    return quote;
  }

  function rowToQuote(row) {
    const quote = clone((row && row.data) || {});
    quote.meta = quote.meta || {};
    if (row && row.id) quote.id = row.id;
    if (row && row.slug) quote.meta.slug = row.slug;
    else quote.meta.slug = quote.meta.slug || '';
    quote.meta.isDraft = false;
    quote.evidence = quote.evidence && quote.evidence.mode
      ? quote.evidence
      : { mode: 'service', generalIds: { videos: [], images: [] } };
    return quote;
  }

  function quoteToPatch(quote) {
    const meta = (quote && quote.meta) || {};
    const patch = { data: cleanQuote(quote) };
    // El slug se reserva al publicar y no se borra al guardar: la URL es estable.
    if (meta.slug) patch.slug = meta.slug;
    return patch;
  }

  function versionSummary(entry) {
    return {
      at: (entry && entry.created_at) || '',
      label: (entry && entry.label) || '',
      published: Boolean(entry && entry.published)
    };
  }

  PADMIN.model = { fromBackup, newClientData, rowToQuote, quoteToPatch, versionSummary, uuid };
})(typeof window !== 'undefined' ? window : globalThis);
