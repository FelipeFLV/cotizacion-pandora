/* Interacciones de la versión cliente: sin edición, sin almacenamiento, sin red.
   Se usa igual en las páginas publicadas (con `__PANDORA__` embebido) y en la
   vista previa del panel (que llama `P.client.init` al recibir los datos). */
(function () {
  'use strict';

  const state = {
    quote: null,
    general: { videos: [], images: [] },
    meta: {}
  };
  let bound = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  function mode() {
    return (state.quote && state.quote.evidence && state.quote.evidence.mode) || 'service';
  }

  function render() {
    P.render.all(state.quote, {
      readonly: true,
      view: 'client',
      evidenceMode: mode(),
      general: state.general
    });

    const generated = state.meta && state.meta.generatedAt;
    const label = $('[data-generated-label]');
    if (label) {
      label.textContent = generated
        ? `Generada el ${P.dateLabel(state.quote.meta.date)} a las ${P.timeLabel(generated)}`
        : '';
    }
  }

  function pauseAll() {
    $$('video').forEach((video) => video.pause());
  }

  function piece(blockIndex, kind, index) {
    if (blockIndex === 'general') return (state.general[kind] || [])[index];
    const block = state.quote.blocks[blockIndex];
    return block ? block[kind][index] : null;
  }

  function playVideo(blockIndex, index) {
    const video = piece(blockIndex, 'videos', index);
    if (!video || !video.src) return;
    const selector = blockIndex === 'general'
      ? `[data-video][data-general="1"][data-index="${index}"]`
      : `[data-video][data-block="${blockIndex}"][data-index="${index}"]`;
    const figure = document.querySelector(selector);
    if (!figure) return;
    const frame = figure.querySelector('.shot-frame');
    const embed = P.render.embedUrl(video.src);
    pauseAll();
    if (embed) {
      frame.innerHTML = `<iframe src="${embed}" title="${P.render.esc(video.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      frame.innerHTML = `<video src="${P.render.esc(P.assetUrl(video.src, P.assetBase))}" poster="${P.render.esc(P.assetUrl(video.poster || '', P.assetBase))}" controls autoplay playsinline></video>`;
    }
    figure.classList.add('is-playing');
  }

  function openLightbox(blockIndex, index) {
    const image = piece(blockIndex, 'images', index);
    if (!image || !image.src) return;
    $('#lbImg').src = P.assetUrl(image.src, P.assetBase);
    $('#lbImg').alt = image.title || '';
    $('#lbCap').textContent = image.title || '';
    $('#lightbox').hidden = false;
    document.body.classList.add('lb-open');
    $('.lb-close').focus();
  }

  function closeLightbox() {
    $('#lightbox').hidden = true;
    document.body.classList.remove('lb-open');
  }

  const actions = {
    'play-video'() {
      playVideo(this.dataset.general ? 'general' : Number(this.dataset.block), Number(this.dataset.index));
    },
    lightbox() {
      openLightbox(this.dataset.general ? 'general' : Number(this.dataset.block), Number(this.dataset.index));
    },
    'close-lightbox'() { closeLightbox(); },
    print() {
      closeLightbox();
      window.print();
    },
    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  function bind() {
    if (bound) return;
    bound = true;

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      const fn = actions[trigger.dataset.action];
      if (!fn) return;
      event.preventDefault();
      fn.call(trigger, event);
    });

    const lightbox = $('#lightbox');
    if (lightbox) {
      lightbox.addEventListener('click', (event) => {
        if (event.target.id === 'lightbox') closeLightbox();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox();
    });

    document.addEventListener('play', (event) => {
      if (event.target.tagName !== 'VIDEO') return;
      $$('video').forEach((video) => {
        if (video !== event.target) video.pause();
      });
    }, true);

    const links = $$('[data-nav]');
    if ('IntersectionObserver' in window) {
      const map = new Map();
      links.forEach((link) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) map.set(target, link);
      });
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => link.removeAttribute('aria-current'));
          const link = map.get(entry.target);
          if (link) link.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      map.forEach((_, section) => observer.observe(section));
    }

    $$('[data-nav]').forEach((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) link.hidden = true;
    });
  }

  function init(data) {
    const payload = data || {};
    if (!payload.quote) return;
    state.quote = payload.quote;
    state.general = payload.general || { videos: [], images: [] };
    state.meta = payload.meta || {};
    bind();
    render();
    document.body.classList.add('ready');
  }

  P.client = { init, render, state };

  if (window.__PANDORA__ && window.__PANDORA__.quote) init(window.__PANDORA__);
})();
