/* Barra lateral del panel: estado de cada cotización y filas seguras. */
(function (root) {
  'use strict';

  const P = root.P;
  const PADMIN = (root.PADMIN = root.PADMIN || {});

  const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'draft', label: 'Borradores' },
    { id: 'published', label: 'Publicadas' },
    { id: 'retired', label: 'Retiradas' }
  ];

  const LABELS = {
    template: 'Plantilla',
    published: 'Publicada',
    retired: 'Retirada',
    draft: 'Borrador',
    pending: 'Publicando'
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function state(row) {
    const entry = row || {};
    if (entry.is_template) return 'template';
    if (entry.pending) return 'pending';
    if (entry.status === 'retired' || entry.retired_at) return 'retired';
    if (entry.status === 'published') return 'published';
    return 'draft';
  }

  function servicesOf(data) {
    const seen = [];
    ((data && data.blocks) || []).forEach((block) => {
      const name = String(block.title || block.serviceName || '').trim();
      if (name && !seen.includes(name)) seen.push(name);
    });
    return seen;
  }

  function urlOf(row) {
    const meta = (row.data && row.data.meta) || {};
    return row.published_url || meta.publishedUrl || '';
  }

  function dateOf(row) {
    const meta = (row.data && row.data.meta) || {};
    if (!meta.date) return '';
    return P && typeof P.dateLabel === 'function' ? P.dateLabel(meta.date) : meta.date;
  }

  function matches(row, filter, query) {
    const kind = state(row);
    if (filter === 'draft' && kind !== 'draft' && kind !== 'template') return false;
    if (filter === 'published' && kind !== 'published') return false;
    if (filter === 'retired' && kind !== 'retired') return false;
    if (!query) return true;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const meta = (row.data && row.data.meta) || {};
    const haystack = [meta.client, meta.quoteNo, row.slug, ...servicesOf(row.data)].join(' ').toLowerCase();
    return haystack.includes(needle);
  }

  function actionsFor(kind, row) {
    const id = esc(row.id);
    if (kind === 'template') {
      return `<button class="mini" data-action="new-client" data-id="${id}">Nuevo cliente</button>`;
    }
    const parts = [
      `<button class="mini" data-action="duplicate" data-id="${id}">Duplicar</button>`,
      `<button class="mini" data-action="history" data-id="${id}">Historial</button>`,
      `<button class="mini" data-action="publish" data-id="${id}">${kind === 'published' ? 'Republicar' : 'Publicar'}</button>`
    ];
    if (kind !== 'published') {
      parts.push(`<button class="mini" data-action="set-template" data-id="${id}">Usar como plantilla</button>`);
    }
    parts.push(`<button class="mini mini-quiet" data-action="archive" data-id="${id}">Archivar</button>`);
    return parts.join('');
  }

  function rowHtml(row, activeId) {
    const kind = state(row);
    const meta = (row.data && row.data.meta) || {};
    const name = meta.client || row.name || 'Cliente sin nombre';
    const services = servicesOf(row.data);
    const date = dateOf(row);
    const url = urlOf(row);
    const classes = ['quote-row', `is-${kind}`];
    if (row.id === activeId) classes.push('is-active');
    return `<article class="${classes.join(' ')}" data-id="${esc(row.id)}" data-state="${kind}">
      <button class="quote-open" data-action="open" data-id="${esc(row.id)}" type="button">
        <span class="quote-name">${esc(name)}</span>
        <span class="quote-line">${esc(services.join(' · '))}${services.length && date ? ' · ' : ''}${esc(date)}</span>
      </button>
      <span class="pill pill-${kind}">${LABELS[kind]}</span>
      ${url && kind === 'published' ? `<a class="quote-link" href="${esc(url)}" target="_blank" rel="noopener">Ver publicada</a>` : ''}
      <div class="quote-actions">${actionsFor(kind, row)}</div>
    </article>`;
  }

  function render(input) {
    const options = input || {};
    const quotes = Array.isArray(options.quotes) ? options.quotes : [];
    const rows = quotes.filter((row) => matches(row, options.filter || 'all', options.query || ''));
    if (!rows.length) {
      return `<p class="quote-empty">${quotes.length
        ? 'Ninguna cotización coincide con el filtro.'
        : 'Importa tu biblioteca o crea la plantilla desde una cotización existente.'}</p>`;
    }
    return rows.map((row) => rowHtml(row, options.activeId)).join('');
  }

  function filters(current) {
    return FILTERS.map((filter) => `<button class="filter${filter.id === (current || 'all') ? ' is-current' : ''}"
      data-filter="${filter.id}" type="button" aria-pressed="${filter.id === (current || 'all')}">${filter.label}</button>`).join('');
  }

  PADMIN.library = { render, state, filters, servicesOf, urlOf, esc, FILTERS, LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
