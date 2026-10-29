/* Publicar y retirar desde el panel. La función Edge hace el commit atómico en
   GitHub; aquí solo se pide, se muestra el estado y se copia la URL. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});

  const LABELS = {
    template: 'Plantilla',
    published: 'Publicada',
    retired: 'Retirada',
    draft: 'Borrador'
  };

  const PUBLISHING = 'Publicando…';
  const PUBLISHED = 'Publicado. GitHub Pages puede tardar un minuto.';
  const RETIRING = 'Retirando…';
  const RETIRED = 'Retirada. La URL dejará de existir en un minuto.';

  let row = null;
  let busy = '';
  let note = '';
  let error = '';
  let versions = null;
  let last = '';
  let hooks = {};

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function configure(options) {
    hooks = options || {};
  }

  function setRow(next) {
    const same = Boolean(row && next && row.id === next.id);
    row = next || null;
    if (!same) versions = null;
  }

  function stateOf(value) {
    const item = value || {};
    if (item.is_template || item.isTemplate) return 'template';
    if (item.status === 'retired' || item.retired_at) return 'retired';
    if (item.status === 'published') return 'published';
    return 'draft';
  }

  function urlOf(value) {
    const item = value || {};
    const meta = (item.data && item.data.meta) || {};
    return item.published_url || meta.publishedUrl || '';
  }

  function clientOf(value) {
    const item = value || {};
    const meta = (item.data && item.data.meta) || {};
    return String(meta.client || '').trim();
  }

  function repaint() {
    if (PADMIN.editor && typeof PADMIN.editor.repaint === 'function') PADMIN.editor.repaint();
  }

  async function call(name, quoteId) {
    if (!quoteId) throw new Error('Falta la cotización.');
    const token = await PADMIN.api.accessToken();
    const response = await root.fetch(`${PADMIN.config.url()}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quoteId })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body && body.error ? body.error : 'No se pudo completar la operación.');
    }
    return body || {};
  }

  async function quote(id) {
    return call('publish', id);
  }

  async function retire(id) {
    return call('retire', id);
  }

  async function copyUrl(url) {
    const value = String(url || '');
    if (!value) return false;
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        await root.navigator.clipboard.writeText(value);
        return true;
      }
    } catch (failure) {
      // Sin permiso de portapapeles: se intenta la copia clásica.
    }
    try {
      const area = root.document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      root.document.body.appendChild(area);
      area.select();
      const ok = root.document.execCommand('copy');
      root.document.body.removeChild(area);
      return Boolean(ok);
    } catch (failure) {
      return false;
    }
  }

  function hintOf(kind, name) {
    if (kind === 'template') return 'La plantilla no se publica: crea un cliente a partir de ella.';
    if (!name) return 'Escribe el nombre del cliente antes de publicar.';
    return 'Publicar crea la página del cliente con el contenido guardado.';
  }

  function render(input) {
    const data = input || {};
    const item = row || data.row || {};
    const quoteData = data.quote || item.data || {};
    const kind = stateOf(item);
    const url = urlOf(item);
    const name = String((quoteData.meta && quoteData.meta.client) || '').trim() || clientOf(item);
    const isBusy = Boolean(busy);
    const canPublish = kind !== 'template' && Boolean(name) && !isBusy;
    const publishLabel = kind === 'published' ? 'Republicar' : (kind === 'retired' ? 'Publicar de nuevo' : 'Publicar');
    const progressLabel = busy === 'retire' ? RETIRING : (busy === 'restore' ? 'Restaurando…' : PUBLISHING);
    const message = error
      ? `<p class="pub-status is-error">${esc(error)} <button class="mini" data-op="pub-retry" type="button">Reintentar</button></p>`
      : (note ? `<p class="pub-status">${esc(note)}</p>` : '');
    const historyBox = versions && PADMIN.history ? PADMIN.history.render({ versions }) : '';

    return `<div class="publish-box" id="publish-box" aria-busy="${isBusy}">
      <div class="pub-head">
        <span class="pill pill-${kind}">${LABELS[kind]}</span>
        ${url ? `<span class="pub-url">${esc(url)}</span>` : '<span class="pub-url is-empty">Sin URL todavía.</span>'}
      </div>
      ${isBusy ? `<div class="pub-progress" role="progressbar" aria-label="${esc(progressLabel)}"></div>` : ''}
      <div class="pub-actions">
        <button class="mini" data-op="pub-publish" type="button"${canPublish ? '' : ' disabled'}>${publishLabel}</button>
        <button class="mini" data-op="pub-retire" type="button"${url && !isBusy ? '' : ' disabled'}>Retirar</button>
        <button class="mini" data-op="pub-copy" type="button"${url ? '' : ' disabled'}>Copiar URL</button>
        ${url ? `<a class="mini pub-link" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>` : ''}
        <button class="mini" data-op="pub-pdf" type="button">PDF A4</button>
        <button class="mini" data-op="pub-history" type="button"${isBusy ? ' disabled' : ''}>${versions ? 'Ocultar historial' : 'Historial'}</button>
      </div>
      ${message}
      <p class="field-hint">${esc(hintOf(kind, name))}</p>
      ${historyBox}
    </div>`;
  }

  function currentName() {
    const live = PADMIN.editor && typeof PADMIN.editor.currentQuote === 'function'
      ? PADMIN.editor.currentQuote()
      : null;
    const meta = (live && live.meta) || {};
    return String(meta.client || '').trim() || clientOf(row);
  }

  async function publish() {
    if (!row || stateOf(row) === 'template') return;
    try {
      await PADMIN.editor.flush();
    } catch (failure) {
      error = 'Guarda los cambios antes de publicar.';
      note = '';
      repaint();
      return;
    }
    if (!currentName()) {
      error = 'Escribe el nombre del cliente antes de publicar.';
      note = '';
      repaint();
      return;
    }
    if (stateOf(row) === 'published' && !root.confirm('Esta cotización ya está publicada. Se reemplazará el contenido y se mantendrá la misma URL. ¿Publicar?')) {
      return;
    }

    last = 'publish';
    busy = 'publish';
    note = PUBLISHING;
    error = '';
    repaint();

    try {
      const result = await quote(row.id);
      row = Object.assign({}, row, {
        status: 'published',
        slug: result.slug || row.slug,
        published_url: result.url,
        published_at: new Date().toISOString(),
        retired_at: null
      });
      note = PUBLISHED;
      if (hooks.onPublished) await hooks.onPublished(row.id, result.url);
    } catch (failure) {
      error = failure && failure.message ? failure.message : 'No se pudo publicar.';
      note = '';
    } finally {
      busy = '';
      repaint();
    }
  }

  async function withdraw() {
    if (!row) return;
    const url = urlOf(row);
    if (!url) return;
    if (!root.confirm(`¿Retirar la página de ${currentName() || 'este cliente'}? La URL ${url} dejará de existir y no se puede deshacer sin volver a publicar.`)) {
      return;
    }
    try {
      await PADMIN.editor.flush();
    } catch (failure) {
      error = 'Guarda los cambios antes de retirar.';
      note = '';
      repaint();
      return;
    }

    last = 'retire';
    busy = 'retire';
    note = RETIRING;
    error = '';
    repaint();

    try {
      await retire(row.id);
      row = Object.assign({}, row, { status: 'retired', retired_at: new Date().toISOString() });
      note = RETIRED;
      if (hooks.onRetired) await hooks.onRetired(row.id);
    } catch (failure) {
      error = failure && failure.message ? failure.message : 'No se pudo retirar.';
      note = '';
    } finally {
      busy = '';
      repaint();
    }
  }

  async function showHistory() {
    if (!row) return;
    if (versions) {
      versions = null;
      error = '';
      repaint();
      return;
    }
    try {
      versions = await PADMIN.api.listVersions(row.id);
      error = '';
    } catch (failure) {
      versions = [];
      error = failure && failure.message ? failure.message : 'No se pudo leer el historial.';
    }
    repaint();
  }

  async function restore(versionId) {
    if (!row || !versionId) return;
    if (!root.confirm('¿Restaurar esta versión? El estado actual se guarda antes de reemplazarlo.')) return;

    busy = 'restore';
    note = 'Restaurando…';
    error = '';
    repaint();

    try {
      await PADMIN.editor.flush();
      const id = row.id;
      await PADMIN.api.createVersion(id, 'Antes de restaurar', false);
      await PADMIN.api.restoreVersion(versionId);
      versions = null;
      note = 'Versión restaurada.';
      if (hooks.onRestored) await hooks.onRestored(id);
    } catch (failure) {
      error = failure && failure.message ? failure.message : 'No se pudo restaurar la versión.';
      note = '';
    } finally {
      busy = '';
      repaint();
    }
  }

  async function op(name, node) {
    const data = (node && node.dataset) || {};
    if (name === 'pub-publish') return publish();
    if (name === 'pub-retire') return withdraw();
    if (name === 'pub-copy') {
      const ok = await copyUrl(urlOf(row));
      note = ok ? 'URL copiada.' : 'No se pudo copiar. Abre el enlace y cópialo de la barra.';
      error = '';
      repaint();
      return;
    }
    if (name === 'pub-pdf') {
      if (hooks.onPdf) await hooks.onPdf();
      return;
    }
    if (name === 'pub-history') return showHistory();
    if (name === 'pub-retry') return last === 'retire' ? withdraw() : publish();
    if (name === 'hist-restore') return restore(data.id);
  }

  PADMIN.publish = {
    configure,
    setRow,
    render,
    op,
    quote,
    retire,
    copyUrl,
    stateOf,
    urlOf,
    LABELS
  };
})(typeof window !== 'undefined' ? window : globalThis);
