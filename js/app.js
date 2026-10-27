/* Interacciones: edición en línea, medios, navegación, exportación e importación. */
(function () {
  'use strict';

  const { store, get, set } = P;

  let quote;
  let editMode = false;
  let saveTimer = null;
  let mediaCtx = null;
  let pickCtx = null;
  let toastTimer = null;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---------- guardado ---------- */

  function saveNow() {
    clearTimeout(saveTimer);
    const ok = store.save();
    if (!ok) toast('No se pudo guardar en este navegador. Exporta los datos para no perderlos.');
  }

  function commit() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ---------- render ---------- */

  function refresh() {
    P.render.all(quote);
    applyEditMode();
    observeSections();
  }

  function refreshPrices() {
    P.render.prices(quote);
    P.render.split(quote);
    P.render.sync(quote);
    applyEditMode();
  }

  function applyEditMode() {
    document.body.classList.toggle('is-editing', editMode);
    $$('.editable').forEach((el) => {
      el.setAttribute('contenteditable', editMode ? 'plaintext-only' : 'false');
      el.spellcheck = false;
    });
    $$('.amt, .pct-input').forEach((input) => {
      input.readOnly = !editMode;
      input.tabIndex = editMode ? 0 : -1;
    });
    $$('[data-action="toggle-edit"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(editMode));
      $('[data-edit-label]', btn).textContent = editMode ? 'Listo' : 'Editar';
    });
  }

  function focusPath(path) {
    const el = document.querySelector(`[data-text="${path}"]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* ---------- navegación ---------- */

  let navObserver = null;
  function observeSections() {
    if (navObserver) navObserver.disconnect();
    const links = $$('[data-nav]');
    const map = new Map();
    links.forEach((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) map.set(target, link);
    });
    navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.removeAttribute('aria-current'));
        const link = map.get(entry.target);
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    map.forEach((_, section) => navObserver.observe(section));
  }

  /* ---------- edición de texto ---------- */

  function onEditableInput(event) {
    const el = event.target.closest('[data-text]');
    if (!el || !editMode) return;
    const value = (el.innerText || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    set(quote, el.dataset.text, value);
    P.render.sync(quote);
    commit();
  }

  function onEditablePaste(event) {
    const el = event.target.closest('[data-text]');
    if (!el) return;
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
  }

  function onEditableKeydown(event) {
    const el = event.target.closest('[data-text]');
    if (!el) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      el.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      el.blur();
    }
  }

  /* ---------- montos y porcentajes ---------- */

  function onAmountInput(event) {
    const input = event.target.closest('.amt');
    if (!input || !editMode) return;
    const value = P.parseNumber(input.value);
    set(quote, input.dataset.amount, value);
    input.style.width = Math.max(5, input.value.length) + 'ch';
    P.render.sync(quote);
    commit();
  }

  function onAmountBlur(event) {
    const input = event.target.closest('.amt');
    if (!input) return;
    const value = P.money(get(quote, input.dataset.amount));
    input.value = value;
    input.style.width = Math.max(5, value.length) + 'ch';
    saveNow();
  }

  function onPctChange(event) {
    const input = event.target.closest('.pct-input');
    if (!input || !editMode) return;
    const value = Math.max(0, Math.min(100, P.parseNumber(input.value)));
    set(quote, input.dataset.pct, value);
    P.render.split(quote);
    P.render.sync(quote);
    applyEditMode();
    saveNow();
  }

  /* ---------- acciones estructurales ---------- */

  function addEntry(listPath, placeholder) {
    const list = get(quote, listPath) || [];
    list.push(placeholder || '');
    saveNow();
    refresh();
    focusPath(`${listPath}.${list.length - 1}`);
  }

  function removeEntry(listPath, index) {
    const list = get(quote, listPath) || [];
    list.splice(index, 1);
    saveNow();
    refresh();
  }

  function addLine(blockIndex) {
    const block = quote.blocks[blockIndex];
    block.items.push({ label: 'Nueva línea', amount: 0 });
    saveNow();
    refreshPrices();
    focusPath(`blocks.${blockIndex}.items.${block.items.length - 1}.label`);
  }

  function addBlock(serviceId) {
    const block = P.blockFromService(serviceId);
    if (!block) return;
    quote.blocks.push(block);
    saveNow();
    refresh();
    const section = document.getElementById('alcance-' + (quote.blocks.length - 1));
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Servicio añadido a la cotización.');
  }

  function replaceBlock(index, serviceId) {
    const fresh = P.blockFromService(serviceId);
    if (!fresh) return;
    fresh.uid = quote.blocks[index].uid;
    quote.blocks[index] = fresh;
    saveNow();
    refresh();
    toast('Servicio actualizado.');
  }

  function removeBlock(index) {
    if (quote.blocks.length < 2) {
      toast('La cotización necesita al menos un servicio.');
      return;
    }
    if (!confirm('¿Quitar este servicio de la cotización? Se perderán su alcance y sus precios.')) return;
    quote.blocks.splice(index, 1);
    saveNow();
    refresh();
  }

  /* ---------- videos y galería ---------- */

  function playVideo(blockIndex, index) {
    const video = quote.blocks[blockIndex].videos[index];
    if (!video || !video.src) {
      toast('Esta pieza todavía no tiene archivo. Usa «Reemplazar» para añadirla.');
      return;
    }
    const figure = document.querySelector(`[data-video][data-block="${blockIndex}"][data-index="${index}"]`);
    const frame = figure.querySelector('.shot-frame');
    const embed = P.render.embedUrl(video.src);
    $$('video').forEach((v) => v.pause());
    if (embed) {
      frame.innerHTML = `<iframe src="${embed}" title="${P.render.esc(video.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      frame.innerHTML = `<video src="${P.render.esc(video.src)}" poster="${P.render.esc(video.poster || '')}" controls autoplay playsinline></video>`;
    }
    figure.classList.add('is-playing');
  }

  function openLightbox(blockIndex, index) {
    const image = quote.blocks[blockIndex].images[index];
    if (!image || !image.src) return;
    $('#lbImg').src = image.src;
    $('#lbImg').alt = image.title || '';
    $('#lbCap').textContent = image.title || '';
    const box = $('#lightbox');
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('open'));
    $('.lb-close', box).focus();
  }

  function closeLightbox() {
    const box = $('#lightbox');
    box.classList.remove('open');
    setTimeout(() => { box.hidden = true; }, 200);
  }

  /* ---------- diálogo de medios ---------- */

  function openMediaDialog(context) {
    mediaCtx = context;
    const form = $('#mediaForm');
    const item = context.index != null
      ? get(quote, `blocks.${context.block}.${context.kind}.${context.index}`)
      : { title: '', src: '' };
    form.reset();
    form.title.value = item.title || '';
    form.src.value = item.src || '';
    $('#mediaHint').textContent = context.kind === 'videos'
      ? 'Ruta local, enlace de YouTube o Vimeo, o un video directo .mp4.'
      : 'Ruta local o enlace directo a la imagen.';
    $('#mediaWarn').hidden = true;
    $('#mediaDelete').hidden = context.index == null;
    $('#mediaDialog').showModal();
    setTimeout(() => form.title.focus(), 60);
  }

  function saveMedia() {
    const form = $('#mediaForm');
    let src = form.src.value.trim();
    const file = form.file.files && form.file.files[0];
    if (file) {
      src = URL.createObjectURL(file);
      toast('Archivo cargado solo para esta sesión. Guarda el archivo en assets/media para conservarlo.');
    }
    if (!src) {
      toast('Añade una ruta, un enlace o un archivo.');
      return false;
    }
    const title = form.title.value.trim() || (mediaCtx.kind === 'videos' ? 'Pieza audiovisual' : 'Pieza de diseño');
    const list = get(quote, `blocks.${mediaCtx.block}.${mediaCtx.kind}`);
    if (mediaCtx.index != null) {
      const current = list[mediaCtx.index];
      list[mediaCtx.index] = {
        title,
        src,
        poster: current.poster && current.src === src ? current.poster : (mediaCtx.kind === 'videos' && !file && !P.render.embedUrl(src) ? '' : current.poster || '')
      };
      if (mediaCtx.kind === 'videos' && current.src !== src && !file) {
        list[mediaCtx.index].poster = '';
      }
    } else {
      list.push({ title, src, poster: '' });
    }
    saveNow();
    refresh();
    $('#mediaDialog').close();
    return true;
  }

  function deleteMedia() {
    if (!mediaCtx || mediaCtx.index == null) return;
    const list = get(quote, `blocks.${mediaCtx.block}.${mediaCtx.kind}`);
    list.splice(mediaCtx.index, 1);
    saveNow();
    refresh();
    $('#mediaDialog').close();
    toast('Pieza eliminada.');
  }

  /* ---------- importar / exportar ---------- */

  function exportJson() {
    const slug = (quote.meta.client || 'cliente').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const blob = new Blob([JSON.stringify(quote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cotizacion-${slug}-${quote.meta.date || ''}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Datos exportados.');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.version !== 1 || !Array.isArray(data.blocks) || !data.blocks.length) {
          throw new Error('Formato no válido');
        }
        quote = data;
        store.quote = quote;
        saveNow();
        refresh();
        toast('Cotización importada.');
      } catch (err) {
        toast('No pudimos leer ese archivo. Revisa que sea un JSON exportado desde este dashboard.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- acciones ---------- */

  const actions = {
    'toggle-edit'() {
      editMode = !editMode;
      applyEditMode();
    },
    print() {
      closeLightbox();
      window.print();
    },
    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => toast('Tu navegador no permitió pantalla completa.'));
    },
    'play-video'() {
      playVideo(Number(this.dataset.block), Number(this.dataset.index));
    },
    lightbox() {
      openLightbox(Number(this.dataset.block), Number(this.dataset.index));
    },
    'close-lightbox'() { closeLightbox(); },
    'add-entry'() { addEntry(this.dataset.list, this.dataset.placeholder); },
    'remove-entry'() { removeEntry(this.dataset.list, Number(this.dataset.index)); },
    'add-line'() { addLine(Number(this.dataset.block)); },
    'remove-block'() { removeBlock(Number(this.dataset.block)); },
    'add-service'() {
      pickCtx = { mode: 'add' };
      $('#serviceDialog').showModal();
    },
    'change-service'() {
      pickCtx = { mode: 'replace', block: Number(this.dataset.block) };
      $('#serviceDialog').showModal();
    },
    'pick-service'() {
      const serviceId = this.dataset.service;
      $('#serviceDialog').close();
      if (!pickCtx) return;
      if (pickCtx.mode === 'replace') replaceBlock(pickCtx.block, serviceId);
      else addBlock(serviceId);
      pickCtx = null;
    },
    'close-service'() { $('#serviceDialog').close(); },
    'edit-media'() {
      openMediaDialog({
        block: Number(this.dataset.block),
        kind: this.dataset.kind,
        index: Number(this.dataset.index)
      });
    },
    'add-media'() {
      openMediaDialog({
        block: Number(this.dataset.block),
        kind: this.dataset.kind,
        index: null
      });
    },
    copy() {
      const value = this.dataset.copy;
      navigator.clipboard.writeText(value).then(
        () => toast('Copiado: ' + value),
        () => toast('No se pudo copiar. Selecciona el número manualmente.')
      );
    },
    reset() {
      if (!confirm('¿Restablecer la cotización al ejemplo inicial? Se perderán los cambios guardados en este navegador.')) return;
      quote = P.defaultQuote();
      store.quote = quote;
      saveNow();
      refresh();
      toast('Cotización restablecida.');
    },
    'export-json'() { exportJson(); },
    'import-json'() { $('#importFile').click(); }
  };

  /* ---------- arranque ---------- */

  function bind() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      const fn = actions[trigger.dataset.action];
      if (!fn) return;
      event.preventDefault();
      fn.call(trigger, event);
    });

    document.addEventListener('input', (event) => {
      if (event.target.closest('.amt')) return onAmountInput(event);
      if (event.target.closest('.editable')) onEditableInput(event);
    });

    document.addEventListener('blur', (event) => {
      if (event.target.closest('.amt')) onAmountBlur(event);
      else if (event.target.closest('.pct-input')) onPctChange(event);
      else if (event.target.matches('[data-input="meta.date"]')) {
        quote.meta.date = event.target.value;
        P.render.sync(quote);
        saveNow();
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-input="meta.date"]')) {
        quote.meta.date = event.target.value;
        P.render.sync(quote);
        saveNow();
      }
      if (event.target.id === 'importFile' && event.target.files[0]) {
        importJson(event.target.files[0]);
        event.target.value = '';
      }
    });

    document.addEventListener('paste', (event) => {
      if (event.target.closest('.editable')) onEditablePaste(event);
    });

    document.addEventListener('keydown', (event) => {
      if (event.target.closest('.editable')) onEditableKeydown(event);
      if (event.key === 'Escape') {
        if (!$('#lightbox').hidden) closeLightbox();
        if (editMode) {
          editMode = false;
          applyEditMode();
        }
      }
    });

    // diálogo de medios
    $('#mediaForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      if (submitter && submitter.value === 'cancel') {
        $('#mediaDialog').close();
        return;
      }
      if (!saveMedia()) return;
    });

    $('#mediaForm').file.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      $('#mediaWarn').hidden = false;
      if (!$('#mediaForm').title.value) {
        $('#mediaForm').title.value = file.name.replace(/\.[^.]+$/, '');
      }
    });

    $('#mediaDelete').addEventListener('click', deleteMedia);

    // lightbox
    $('#lightbox').addEventListener('click', (event) => {
      if (event.target.id === 'lightbox') closeLightbox();
    });

    // pausar otros videos al reproducir
    document.addEventListener('play', (event) => {
      if (event.target.tagName !== 'VIDEO') return;
      $$('video').forEach((video) => {
        if (video !== event.target) video.pause();
      });
    }, true);
  }

  function init() {
    quote = store.load();
    P.render.all(quote);
    bind();
    applyEditMode();
    observeSections();
    document.body.classList.add('ready');
    window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
