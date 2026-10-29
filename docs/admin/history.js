/* Historial de versiones dentro del bloque de publicación. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function two(value) {
    return String(value).padStart(2, '0');
  }

  function when(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
  }

  function label(version) {
    const text = String((version && version.label) || '').trim();
    if (text) return text;
    return version && version.published ? 'Publicación' : 'Captura manual';
  }

  function rowHtml(version) {
    const item = version || {};
    return `<li class="hist-item">
      <span class="hist-when">${esc(when(item.created_at))}</span>
      <span class="hist-label">${esc(label(item))}</span>
      ${item.published ? '<span class="pill pill-published">Publicada</span>' : ''}
      <button class="mini" data-op="hist-restore" data-id="${esc(item.id)}" type="button">Restaurar</button>
    </li>`;
  }

  function render(input) {
    const versions = (input && input.versions) || [];
    const items = versions.length
      ? versions.map(rowHtml).join('')
      : '<li class="hist-empty">Todavía no hay versiones. Se guardan al publicar o al hacer una captura manual.</li>';
    return `<div class="hist" id="pub-history">
      <div class="hist-head">
        <span class="ev-label">Historial</span>
        <button class="mini mini-quiet" data-op="pub-history" type="button">Cerrar</button>
      </div>
      <ul class="hist-list">${items}</ul>
      <p class="field-hint">Se conservan las últimas 10 versiones. Restaurar guarda antes el estado actual.</p>
    </div>`;
  }

  PADMIN.history = { render, when, label };
})(typeof window !== 'undefined' ? window : globalThis);
