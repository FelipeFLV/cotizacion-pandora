/* Gestor de evidencias: piezas por servicio, banco reutilizable y modo de la
   versión cliente. Todo el HTML se construye con datos escapados. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});

  const MODES = [
    { id: 'service', label: 'Servicio' },
    { id: 'general', label: 'General' },
    { id: 'both', label: 'Ambas' },
    { id: 'none', label: 'Ocultar' }
  ];

  const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function youtubeThumb(src) {
    const match = String(src || '').match(YOUTUBE_RE);
    return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : '';
  }

  function generalIds(quote, kind) {
    const ids = (quote && quote.evidence && quote.evidence.generalIds) || {};
    return ids[kind] || [];
  }

  function modeOf(quote) {
    return (quote && quote.evidence && quote.evidence.mode) || 'service';
  }

  function thumbSrc(piece, signedMap) {
    const src = String((piece && piece.src) || '');
    const match = src.match(/^media:([A-Za-z0-9_-]{1,64})$/);
    if (match) return (signedMap && signedMap[match[1]]) || '';
    if (/^assets\//.test(src)) return src;
    const youtube = youtubeThumb(src);
    if (youtube) return youtube;
    if (/^https:\/\//i.test(src)) return src;
    return '';
  }

  function pieceRow(piece, path, index, kind, signedMap) {
    const thumb = thumbSrc(piece, signedMap);
    return `<li class="ev-item">
      <span class="ev-thumb${thumb ? '' : ' is-empty'}" aria-hidden="true">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : (kind === 'videos' ? '▶' : '▣')}</span>
      <span class="ev-info">
        <input class="ev-name" data-field="${esc(path)}.${index}.title" value="${esc(piece.title)}" placeholder="Título de la pieza" aria-label="Título de la pieza">
        <span class="ev-src">${esc(piece.src)}</span>
      </span>
      <span class="ev-tools">
        <button class="mini" data-op="ev-bank-add" data-path="${esc(path)}" data-index="${index}" type="button">Al banco</button>
        <button class="mini mini-quiet" data-op="ev-del" data-path="${esc(path)}" data-index="${index}" type="button">Quitar</button>
      </span>
    </li>`;
  }

  function addRow(path, kind) {
    const isVideo = kind === 'videos';
    const op = isVideo ? 'ev-add-video' : 'ev-add-image';
    return `<div class="ev-add" data-ev-row="${esc(path)}">
      <input data-ev-input="${esc(path)}" data-kind="${kind}" placeholder="${isVideo ? 'https://youtu.be/…' : 'https://… o sube un archivo'}" aria-label="${isVideo ? 'Enlace del video' : 'Enlace de la imagen'}">
      <button class="mini" data-op="${op}" data-path="${esc(path)}" type="button">Añadir</button>
      ${isVideo ? '' : `<label class="mini ev-file">Subir<input type="file" accept="image/jpeg,image/png,image/webp" data-ev-file="${esc(path)}" data-kind="image"></label>`}
    </div>
    <p class="ev-error" data-ev-error="${esc(path)}" hidden></p>`;
  }

  function blockPanel(block, index, signedMap) {
    const base = `blocks.${index}`;
    const videos = (block.videos || []).map((piece, i) => pieceRow(piece, `${base}.videos`, i, 'videos', signedMap)).join('');
    const images = (block.images || []).map((piece, i) => pieceRow(piece, `${base}.images`, i, 'images', signedMap)).join('');
    return `<article class="ev-block" data-ev-block="${index}">
      <header class="ev-block-head">
        <h4>${esc(block.title || 'Servicio sin título')}</h4>
      </header>
      <div class="ev-group">
        <span class="ev-label">Videos</span>
        ${videos ? `<ul class="ev-list">${videos}</ul>` : '<p class="ev-empty">Sin videos.</p>'}
        ${addRow(`${base}.videos`, 'videos')}
      </div>
      <div class="ev-group">
        <span class="ev-label">Imágenes</span>
        ${images ? `<ul class="ev-list">${images}</ul>` : '<p class="ev-empty">Sin imágenes.</p>'}
        ${addRow(`${base}.images`, 'images')}
      </div>
    </article>`;
  }

  function bankPanel(quote, bank, signedMap) {
    const items = bank || [];
    if (!items.length) {
      return `<div class="ev-bank">
        <span class="ev-label">Banco general</span>
        <p class="ev-empty">Aún no hay piezas en el banco. Usa «Al banco» en cualquier evidencia.</p>
      </div>`;
    }
    const rows = items.map((item) => {
      const key = item.kind === 'video' ? 'videos' : 'images';
      const checked = generalIds(quote, key).indexOf(item.id) >= 0;
      const src = item.media_id ? `media:${item.media_id}` : item.url;
      const thumb = thumbSrc({ src }, signedMap);
      return `<li class="ev-item">
        <span class="ev-thumb${thumb ? '' : ' is-empty'}" aria-hidden="true">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : (item.kind === 'video' ? '▶' : '▣')}</span>
        <span class="ev-info">
          <span class="ev-name-static">${esc(item.title || 'Sin título')}</span>
          <span class="ev-src">${esc(item.service ? `${item.service} · ${src}` : src)}</span>
        </span>
        <span class="ev-tools">
          <label class="ev-check"><input type="checkbox" data-op="ev-toggle-general" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}"${checked ? ' checked' : ''}> En esta cotización</label>
          <button class="mini mini-quiet" data-op="ev-bank-remove" data-id="${esc(item.id)}" type="button">Quitar del banco</button>
        </span>
      </li>`;
    }).join('');
    return `<div class="ev-bank">
      <span class="ev-label">Banco general</span>
      <p class="field-hint">Marca las piezas que quieres mostrar en la versión cliente.</p>
      <ul class="ev-list">${rows}</ul>
    </div>`;
  }

  function render(options) {
    const data = options || {};
    const quote = data.quote || {};
    const signedMap = data.signedMap || {};
    const mode = modeOf(quote);
    const modes = MODES.map((item) => `<button class="mini${item.id === mode ? ' is-active' : ''}" data-op="ev-mode" data-ev-mode="${item.id}" aria-pressed="${item.id === mode}" type="button">${item.label}</button>`).join('');
    const blocks = (quote.blocks || []).map((block, index) => blockPanel(block, index, signedMap)).join('');
    return `<div class="ev">
      <div class="ev-mode">
        <span class="ev-label">Evidencias en la versión cliente</span>
        <div class="ev-modes" role="group" aria-label="Modo de evidencias">${modes}</div>
      </div>
      ${blocks || '<p class="ev-empty">Añade un servicio para cargar sus evidencias.</p>'}
      ${bankPanel(quote, data.bank, signedMap)}
    </div>`;
  }

  function setPath(quote, path, value) {
    const out = clone(quote);
    const keys = String(path).split('.');
    let node = out;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (!node[key] || typeof node[key] !== 'object') node[key] = {};
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
    return out;
  }

  function listAt(quote, path) {
    const keys = String(path || '').split('.');
    let node = quote;
    for (let i = 0; i < keys.length; i += 1) {
      if (!node) return null;
      node = node[keys[i]];
    }
    return Array.isArray(node) ? node : null;
  }

  function appendPiece(quote, path, piece) {
    const list = listAt(quote, path);
    if (!list) return quote;
    const out = clone(quote);
    listAt(out, path).push(piece);
    return out;
  }

  function inputValue(node) {
    const host = node.parentElement;
    if (!host) return null;
    return host.querySelector('[data-ev-input]') || host.querySelector('input');
  }

  function op(name, quote, node) {
    const dataset = (node && node.dataset) || {};

    if (name === 'ev-mode') {
      if (!dataset.evMode) return quote;
      return setPath(quote, 'evidence.mode', dataset.evMode);
    }

    if (name === 'ev-add-video' || name === 'ev-add-image') {
      const input = inputValue(node);
      const value = String((input && input.value) || '').trim();
      if (!value || !dataset.path) return quote;
      const kind = /\.videos$/.test(dataset.path) ? 'Video' : 'Imagen';
      return appendPiece(quote, dataset.path, {
        title: (input.dataset && input.dataset.title) || kind,
        src: value,
        poster: ''
      });
    }

    if (name === 'ev-del') {
      const list = listAt(quote, dataset.path);
      const index = Number(dataset.index);
      if (!list || index < 0 || index >= list.length) return quote;
      const out = clone(quote);
      listAt(out, dataset.path).splice(index, 1);
      return out;
    }

    if (name === 'ev-toggle-general') {
      const key = dataset.kind === 'video' ? 'videos' : 'images';
      if (!dataset.id) return quote;
      const out = clone(quote);
      out.evidence = out.evidence || { mode: 'service', generalIds: { videos: [], images: [] } };
      out.evidence.generalIds = out.evidence.generalIds || { videos: [], images: [] };
      const list = (out.evidence.generalIds[key] = out.evidence.generalIds[key] || []);
      const at = list.indexOf(dataset.id);
      if (node.checked && at < 0) list.push(dataset.id);
      if (!node.checked && at >= 0) list.splice(at, 1);
      return out;
    }

    return quote;
  }

  PADMIN.evidence = { render, op, MODES, youtubeThumb, esc, listAt, appendPiece };
})(typeof window !== 'undefined' ? window : globalThis);
