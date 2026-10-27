/* Estado de la cotización activa: carga y guardado en el navegador.
   Las utilidades puras viven en docs/app/core.js. */
(function () {
  'use strict';

  const KEY = 'pandora.cotizacion.v1';

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

  P.store = store;
})();
