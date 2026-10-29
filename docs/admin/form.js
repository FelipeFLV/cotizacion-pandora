/* Campos del editor: HTML plano con data-field. Sin contenteditable. */
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

  function labelFor(path) {
    return String(path).replace(/\./g, '-');
  }

  function hint(value) {
    return value ? `<small class="field-hint">${esc(value)}</small>` : '';
  }

  function text({ path, label, value, hint: note, type }) {
    return `<label class="field" for="f-${labelFor(path)}">
      <span>${esc(label)}</span>
      <input id="f-${labelFor(path)}" data-field="${esc(path)}" type="${esc(type || 'text')}" value="${esc(value)}">
      ${hint(note)}
    </label>`;
  }

  function date({ path, label, value }) {
    return text({ path, label, value, type: 'date' });
  }

  function number({ path, label, value, hint: note }) {
    return `<label class="field" for="f-${labelFor(path)}">
      <span>${esc(label)}</span>
      <input id="f-${labelFor(path)}" data-field="${esc(path)}" type="number" step="any" value="${esc(value)}">
      ${hint(note)}
    </label>`;
  }

  function money({ path, label, value, hint: note }) {
    return `<label class="field field-money" for="f-${labelFor(path)}">
      <span>${esc(label)}</span>
      <span class="money-wrap"><em>S/</em><input id="f-${labelFor(path)}" data-field="${esc(path)}" type="number" step="0.01" min="0" value="${esc(value)}"></span>
      ${hint(note)}
    </label>`;
  }

  function textarea({ path, label, value, rows, hint: note }) {
    return `<label class="field field-wide" for="f-${labelFor(path)}">
      <span>${esc(label)}</span>
      <textarea id="f-${labelFor(path)}" data-field="${esc(path)}" rows="${Number(rows) || 3}">${esc(value)}</textarea>
      ${hint(note)}
    </label>`;
  }

  function list({ path, label, items, rows, hint: note }) {
    const value = Array.isArray(items) ? items.join('\n') : '';
    return `<label class="field field-wide" for="f-${labelFor(path)}">
      <span>${esc(label)}</span>
      <textarea id="f-${labelFor(path)}" data-field="${esc(path)}" data-kind="lines" rows="${Number(rows) || 4}">${esc(value)}</textarea>
      ${hint(note || 'Una por línea.')}
    </label>`;
  }

  function check({ path, label, checked, hint: note }) {
    return `<label class="field field-check" for="f-${labelFor(path)}">
      <input id="f-${labelFor(path)}" data-field="${esc(path)}" type="checkbox"${checked ? ' checked' : ''}>
      <span>${esc(label)}</span>
      ${hint(note)}
    </label>`;
  }

  PADMIN.form = { esc, text, date, number, money, textarea, list, check };
})(typeof window !== 'undefined' ? window : globalThis);
