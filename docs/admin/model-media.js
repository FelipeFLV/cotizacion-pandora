/* Sustituye referencias `media:<id>` por URLs firmadas en el navegador.
   Debe dar el mismo resultado que `applyMediaMap` del renderizador compartido. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});
  const MEDIA_RE = /^media:([A-Za-z0-9_-]{1,64})$/;

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function rewrite(list, map) {
    return (list || []).map((piece) => {
      const next = Object.assign({}, piece);
      ['src', 'poster'].forEach((field) => {
        const match = String(next[field] || '').match(MEDIA_RE);
        if (match && Object.prototype.hasOwnProperty.call(map, match[1])) {
          next[field] = map[match[1]];
        }
      });
      return next;
    });
  }

  function resolve(quote, general, signedMap) {
    const map = signedMap || {};
    const nextQuote = clone(quote || {});
    (nextQuote.blocks || []).forEach((block) => {
      block.videos = rewrite(block.videos, map);
      block.images = rewrite(block.images, map);
    });
    const nextGeneral = clone(general || { videos: [], images: [] });
    nextGeneral.videos = rewrite(nextGeneral.videos, map);
    nextGeneral.images = rewrite(nextGeneral.images, map);
    return { quote: nextQuote, general: nextGeneral };
  }

  function refs(quote, general) {
    const ids = new Set();
    const pieces = [];
    ((quote && quote.blocks) || []).forEach((block) => {
      pieces.push(...(block.videos || []), ...(block.images || []));
    });
    const source = general || {};
    pieces.push(...(source.videos || []), ...(source.images || []));
    pieces.forEach((piece) => {
      [piece && piece.src, piece && piece.poster].forEach((value) => {
        const match = String(value || '').match(MEDIA_RE);
        if (match) ids.add(match[1]);
      });
    });
    return Array.from(ids);
  }

  PADMIN.modelMedia = { resolve, refs, MEDIA_RE };
})(typeof window !== 'undefined' ? window : globalThis);
