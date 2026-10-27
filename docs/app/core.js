/* Utilidades puras compartidas entre la matriz (file://) y la versión cliente (Pages).
   UMD: en el navegador se adjunta a window.P; en Node se exporta para las pruebas. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.P = Object.assign(root.P || {}, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const nf = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ABSOLUTE = /^(?:https?:|data:|blob:|file:|\/)/i;

  function get(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }

  function set(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let target = obj;
    keys.forEach((key) => {
      if (target[key] == null || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    target[last] = value;
  }

  function totals(quote) {
    let subtotal = 0;
    (quote.blocks || []).forEach((block) => {
      (block.items || []).forEach((item) => {
        subtotal += Number(item.amount) || 0;
      });
    });
    const rate = quote.meta.taxEnabled ? Number(quote.meta.taxRate) || 0 : 0;
    const igv = subtotal * (rate / 100);
    return { subtotal, igv, grand: subtotal + igv, rate };
  }

  function money(value) {
    return nf.format(Number(value) || 0);
  }

  function moneyS(value) {
    return 'S/ ' + money(value);
  }

  function parseNumber(input) {
    if (typeof input === 'number') return input;
    let raw = String(input || '').replace(/[^\d.,-]/g, '');
    if (!raw) return 0;
    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
    if (hasComma && hasDot) {
      raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    } else if (hasComma) {
      raw = raw.replace(',', '.');
    }
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function dateLabel(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} de ${MONTHS[m - 1]} de ${y}`;
  }

  function shortDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }

  function todayISO(now) {
    const d = now instanceof Date ? now : new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function timeLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function uid(prefix) {
    return (prefix == null ? 'b' : prefix) + Math.random().toString(36).slice(2, 8);
  }

  function slugify(text) {
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

  function uniqueSlug(text, suffix) {
    const tail = suffix || Math.random().toString(36).slice(2, 6);
    return `${slugify(text)}-${tail}`;
  }

  function assetUrl(src, base) {
    const value = String(src == null ? '' : src);
    if (!value || ABSOLUTE.test(value)) return value;
    return (base || '') + value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    get,
    set,
    totals,
    money,
    moneyS,
    parseNumber,
    dateLabel,
    shortDate,
    todayISO,
    timeLabel,
    uid,
    slugify,
    uniqueSlug,
    assetUrl,
    clone
  };
});
