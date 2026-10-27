/* Estado de la cotización: carga, guardado local, cálculo de totales y utilidades. */
(function () {
  'use strict';

  const KEY = 'pandora.cotizacion.v1';
  const nf = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const store = {
    quote: null,
    listeners: new Set(),

    load() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch (err) {
        saved = null;
      }
      const usable = saved && saved.version === 1 && Array.isArray(saved.blocks) && saved.blocks.length;
      this.quote = usable ? saved : P.defaultQuote();
      return this.quote;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.quote));
        return true;
      } catch (err) {
        return false;
      }
    },

    reset() {
      this.quote = P.defaultQuote();
      this.save();
      this.emit();
    },

    emit() {
      this.listeners.forEach((fn) => fn(this.quote));
    },

    onChange(fn) {
      this.listeners.add(fn);
    }
  };

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
    const n = Number(value) || 0;
    return nf.format(n);
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

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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

  function uid() {
    return 'b' + Math.random().toString(36).slice(2, 8);
  }

  P.store = store;
  P.get = get;
  P.set = set;
  P.totals = totals;
  P.money = money;
  P.moneyS = moneyS;
  P.parseNumber = parseNumber;
  P.dateLabel = dateLabel;
  P.shortDate = shortDate;
  P.uid = uid;
})();
