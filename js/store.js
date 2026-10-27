/* Biblioteca de cotizaciones: carga, migración, versiones y respaldo.
   Las utilidades puras viven en docs/app/core.js; el catálogo en js/catalog.js. */
(function (root, factory) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('../docs/app/core.js') : root.P;
  const catalog = isNode ? require('./catalog.js') : root.P;
  const api = factory(core, catalog);
  if (isNode) {
    Object.assign(core, api);
    module.exports = api;
  } else {
    root.P = Object.assign(root.P || {}, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, C) {
  'use strict';

  const KEY = 'pandora.biblioteca.v1';
  const OLD_KEY = 'pandora.cotizacion.v1';
  const MAX_VERSIONS = 10;

  const now = () => new Date().toISOString();

  function defaultStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (err) {
      return null;
    }
  }

  function emptyBank() {
    return { videos: [], images: [] };
  }

  function makeEntry(quote, id) {
    const entryId = id || 'q_' + P.uid('');
    quote.id = entryId;
    if (!quote.name) quote.name = quote.meta.client || 'Cliente sin nombre';
    return {
      id: entryId,
      name: quote.meta.client || 'Cliente sin nombre',
      updatedAt: now(),
      quote,
      versions: []
    };
  }

  function migrateQuote(old, id) {
    const quote = P.clone(old);
    quote.version = 2;
    quote.id = id;
    quote.evidence = quote.evidence && quote.evidence.mode
      ? quote.evidence
      : { mode: 'service', generalIds: { videos: [], images: [] } };
    quote.meta = quote.meta || {};
    quote.meta.slug = quote.meta.slug
      || (!quote.meta.client || quote.meta.client === 'H&S Inmobiliaria' ? C.LEGACY_HS_SLUG : '');
    quote.meta.generatedAt = quote.meta.generatedAt || '';
    quote.meta.publishedUrl = quote.meta.publishedUrl || '';
    quote.meta.publishedAt = quote.meta.publishedAt || '';
    quote.meta.retiredAt = quote.meta.retiredAt || '';
    quote.blocks = (quote.blocks || []).map((block) => {
      if (!block.serviceName) {
        const service = C.catalog[block.serviceId];
        block.serviceName = service ? service.name : block.title || 'Servicio';
      }
      return block;
    });
    return quote;
  }

  function normalize(lib) {
    if (!lib.evidenceBank || !Array.isArray(lib.evidenceBank.videos)) lib.evidenceBank = emptyBank();
    if (!Array.isArray(lib.evidenceBank.images)) lib.evidenceBank.images = [];
    lib.quotes = (lib.quotes || []).map((entry) => {
      if (!entry.id) entry.id = 'q_' + P.uid('');
      entry.quote = entry.quote || C.defaultQuote();
      entry.quote.id = entry.id;
      entry.name = entry.quote.meta && entry.quote.meta.client ? entry.quote.meta.client : (entry.name || 'Cliente sin nombre');
      entry.updatedAt = entry.updatedAt || now();
      entry.versions = Array.isArray(entry.versions) ? entry.versions : [];
      return entry;
    });
    if (!lib.quotes.some((entry) => entry.id === lib.activeId)) {
      lib.activeId = lib.quotes.length ? lib.quotes[0].id : null;
    }
    lib.version = 1;
    return lib;
  }

  function fresh() {
    const entry = makeEntry(C.defaultQuote());
    return { version: 1, activeId: entry.id, evidenceBank: emptyBank(), quotes: [entry] };
  }

  const library = {
    KEY,
    OLD_KEY,
    MAX_VERSIONS,

    load(storage) {
      const store = storage || defaultStorage();
      let lib = null;
      try {
        lib = JSON.parse((store && store.getItem(KEY)) || 'null');
      } catch (err) {
        lib = null;
      }

      let migratedOld = null;
      if (!lib || lib.version !== 1 || !Array.isArray(lib.quotes) || !lib.quotes.length) {
        try {
          migratedOld = JSON.parse((store && store.getItem(OLD_KEY)) || 'null');
        } catch (err) {
          migratedOld = null;
        }
        const usable = migratedOld && Array.isArray(migratedOld.blocks) && migratedOld.blocks.length;
        if (usable) {
          const entry = makeEntry(migrateQuote(migratedOld, 'q_' + P.uid('')));
          lib = { version: 1, activeId: entry.id, evidenceBank: emptyBank(), quotes: [entry] };
        } else {
          lib = fresh();
        }
      }

      normalize(lib);
      if (!lib.evidenceBank.videos.length && !lib.evidenceBank.images.length) {
        lib.evidenceBank = C.seedEvidenceBank();
      }
      library.save(lib, store);
      if (migratedOld && store && store.removeItem) store.removeItem(OLD_KEY);
      return lib;
    },

    save(lib, storage) {
      const store = storage || defaultStorage();
      if (!store) return false;
      try {
        store.setItem(KEY, JSON.stringify(lib));
        return true;
      } catch (err) {
        return false;
      }
    },

    active(lib) {
      return lib.quotes.find((entry) => entry.id === lib.activeId) || lib.quotes[0];
    },

    setActive(lib, id) {
      if (!lib.quotes.some((entry) => entry.id === id)) return library.active(lib);
      lib.activeId = id;
      return library.active(lib);
    },

    add(lib, quote) {
      const entry = makeEntry(quote);
      lib.quotes.push(entry);
      lib.activeId = entry.id;
      return entry;
    },

    duplicate(lib, id) {
      const source = lib.quotes.find((entry) => entry.id === id);
      if (!source) return null;
      const quote = P.clone(source.quote);
      const entry = makeEntry(quote);
      quote.meta = quote.meta || {};
      quote.meta.client = `${source.name} (copia)`;
      entry.name = quote.meta.client;
      quote.meta.slug = '';
      quote.meta.generatedAt = '';
      quote.meta.publishedUrl = '';
      quote.meta.publishedAt = '';
      quote.meta.retiredAt = '';
      entry.versions = [];
      lib.quotes.push(entry);
      lib.activeId = entry.id;
      return entry;
    },

    remove(lib, id) {
      if (lib.quotes.length <= 1) return false;
      const index = lib.quotes.findIndex((entry) => entry.id === id);
      if (index === -1) return false;
      lib.quotes.splice(index, 1);
      if (lib.activeId === id) lib.activeId = lib.quotes[0].id;
      return true;
    },

    update(lib, id, quote) {
      const entry = lib.quotes.find((item) => item.id === id);
      if (!entry) return null;
      entry.quote = quote;
      entry.quote.id = id;
      entry.name = quote.meta && quote.meta.client ? quote.meta.client : 'Cliente sin nombre';
      entry.updatedAt = now();
      return entry;
    },

    snapshot(lib, id, label) {
      const entry = lib.quotes.find((item) => item.id === id);
      if (!entry) return null;
      entry.versions.unshift({
        at: now(),
        label: label || '',
        quote: P.clone(entry.quote)
      });
      entry.versions = entry.versions.slice(0, MAX_VERSIONS);
      return entry;
    },

    restore(lib, id, at) {
      const entry = lib.quotes.find((item) => item.id === id);
      if (!entry) return null;
      const version = entry.versions.find((item) => item.at === at);
      if (!version) return null;
      entry.quote = P.clone(version.quote);
      entry.quote.id = id;
      entry.name = entry.quote.meta.client || entry.name;
      entry.updatedAt = now();
      return entry.quote;
    },

    removeBankPiece(lib, kind, id) {
      const list = lib.evidenceBank && lib.evidenceBank[kind];
      if (!Array.isArray(list)) return false;
      const before = list.length;
      lib.evidenceBank[kind] = list.filter((piece) => piece.id !== id);
      lib.quotes.forEach((entry) => {
        const ids = entry.quote.evidence && entry.quote.evidence.generalIds
          ? entry.quote.evidence.generalIds[kind]
          : null;
        if (Array.isArray(ids)) {
          entry.quote.evidence.generalIds[kind] = ids.filter((item) => item !== id);
        }
      });
      return lib.evidenceBank[kind].length !== before;
    }
  };

  const store = {
    lib: null,
    quote: null,
    listeners: new Set(),

    load() {
      this.lib = library.load();
      this.quote = library.active(this.lib).quote;
      return this.quote;
    },

    save() {
      if (!this.lib) return false;
      library.update(this.lib, this.lib.activeId, this.quote);
      return library.save(this.lib);
    },

    switchTo(id) {
      this.save();
      library.setActive(this.lib, id);
      this.quote = library.active(this.lib).quote;
      this.emit();
    },

    reset() {
      const id = this.lib.activeId;
      const freshQuote = C.defaultQuote();
      freshQuote.id = id;
      freshQuote.meta.slug = '';
      freshQuote.meta.generatedAt = '';
      freshQuote.meta.publishedUrl = '';
      freshQuote.meta.publishedAt = '';
      freshQuote.meta.retiredAt = '';
      this.quote = freshQuote;
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

  return { library, store };
});
