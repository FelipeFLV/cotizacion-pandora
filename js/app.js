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
    const note = $('.edit-hint');
    if (ok) {
      if (note) note.textContent = `Guardado en este navegador · ${P.timeLabel(new Date().toISOString())}`;
    } else {
      toast('No se pudo guardar en este navegador. Descarga un respaldo desde Cotizaciones.');
    }
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

  function currentGeneral() {
    ensureEvidence();
    const bank = store.lib.evidenceBank;
    const ids = quote.evidence.generalIds;
    return {
      videos: (bank.videos || []).filter((piece) => ids.videos.includes(piece.id)),
      images: (bank.images || []).filter((piece) => ids.images.includes(piece.id))
    };
  }

  function renderOptions() {
    ensureEvidence();
    return { evidenceMode: quote.evidence.mode, general: currentGeneral() };
  }

  function refresh() {
    P.render.all(quote, renderOptions());
    applyEditMode();
    observeSections();
    updateEvidenceBadge();
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
    const video = blockIndex === 'general'
      ? currentGeneral().videos[index]
      : quote.blocks[blockIndex].videos[index];
    if (!video || !video.src) {
      toast('Esta pieza todavía no tiene archivo. Usa «Reemplazar» para añadirla.');
      return;
    }
    const figure = blockIndex === 'general'
      ? document.querySelector(`[data-video][data-general="1"][data-index="${index}"]`)
      : document.querySelector(`[data-video][data-block="${blockIndex}"][data-index="${index}"]`);
    const frame = figure.querySelector('.shot-frame');
    const embed = P.render.embedUrl(video.src);
    $$('video').forEach((v) => v.pause());
    if (embed) {
      frame.innerHTML = `<iframe src="${embed}" title="${P.render.esc(video.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      frame.innerHTML = `<video src="${P.render.esc(P.assetUrl(video.src, P.assetBase))}" poster="${P.render.esc(P.assetUrl(video.poster || '', P.assetBase))}" controls autoplay playsinline></video>`;
    }
    figure.classList.add('is-playing');
  }

  function openLightbox(blockIndex, index) {
    const image = blockIndex === 'general'
      ? currentGeneral().images[index]
      : quote.blocks[blockIndex].images[index];
    if (!image || !image.src) return;
    $('#lbImg').src = P.assetUrl(image.src, P.assetBase);
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
    const bank = !!context.bank;
    const list = bank ? store.lib.evidenceBank[context.kind] : get(quote, `blocks.${context.block}.${context.kind}`);
    const item = context.index != null ? list[context.index] : { title: '', src: '' };

    form.reset();
    form.title.value = item.title || '';
    form.src.value = item.src || '';
    $('#mediaTitle').textContent = context.index == null
      ? (bank ? 'Añadir pieza al banco' : 'Añadir pieza')
      : (bank ? 'Reemplazar pieza del banco' : 'Reemplazar pieza');
    $('#mediaServiceField').hidden = !bank;
    if (bank) {
      form.service.innerHTML = Object.values(P.catalog)
        .map((service) => `<option value="${esc(service.name)}">${esc(service.name)}</option>`)
        .join('') + '<option value="General">General</option>';
      form.service.value = item.service || 'General';
    }
    $('#mediaHint').textContent = context.kind === 'videos'
      ? 'Ruta local, enlace de YouTube o Vimeo, o un video directo .mp4.'
      : 'Ruta local o enlace directo a la imagen.';
    $('#mediaWarn').innerHTML = bank
      ? 'El archivo se verá ahora, pero para publicarlo cópialo a la carpeta <code>docs/assets/media/general/</code> y usa su ruta.'
      : 'El archivo se verá ahora, pero para publicarlo guárdalo en la carpeta <code>docs/assets/media/</code> y usa su ruta.';
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

    if (mediaCtx.bank) {
      const list = store.lib.evidenceBank[mediaCtx.kind];
      const service = (form.service && form.service.value) || 'General';
      const poster = () => (mediaCtx.kind === 'videos' && !file && !P.render.embedUrl(src) ? '' : '');
      if (mediaCtx.index != null) {
        const current = list[mediaCtx.index];
        list[mediaCtx.index] = {
          ...current,
          title,
          src,
          service,
          poster: current.src === src ? current.poster || '' : poster()
        };
      } else {
        list.push({ id: P.uid('e'), title, src, service, poster: poster() });
      }
      saveNow();
      renderEvidence();
      $('#mediaDialog').close();
      return true;
    }

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

    if (mediaCtx.bank) {
      const piece = store.lib.evidenceBank[mediaCtx.kind][mediaCtx.index];
      if (!piece) return;
      P.library.removeBankPiece(store.lib, mediaCtx.kind, piece.id);
      saveNow();
      refresh();
      renderEvidence();
      $('#mediaDialog').close();
      toast('Pieza quitada del banco.');
      return;
    }

    const list = get(quote, `blocks.${mediaCtx.block}.${mediaCtx.kind}`);
    list.splice(mediaCtx.index, 1);
    saveNow();
    refresh();
    $('#mediaDialog').close();
    toast('Pieza eliminada.');
  }

  /* ---------- evidencias ---------- */

  function ensureEvidence() {
    if (!quote.evidence) quote.evidence = { mode: 'service', generalIds: { videos: [], images: [] } };
    const ev = quote.evidence;
    if (!ev.mode) ev.mode = 'service';
    ev.generalIds = ev.generalIds || {};
    ['videos', 'images'].forEach((kind) => {
      if (!Array.isArray(ev.generalIds[kind])) ev.generalIds[kind] = [];
    });
  }

  function updateEvidenceBadge() {
    ensureEvidence();
    const total = quote.evidence.generalIds.videos.length + quote.evidence.generalIds.images.length;
    $$('[data-evidence-count]').forEach((el) => {
      el.textContent = String(total);
      el.hidden = total === 0;
    });
  }

  function bankThumb(kind, piece) {
    const src = kind === 'videos' ? (piece.poster || '') : (piece.src || '');
    if (!src) {
      return `<span class="bank-thumb bank-thumb-empty" aria-hidden="true">${kind === 'videos' ? '▶' : '▢'}</span>`;
    }
    return `<img class="bank-thumb" src="${esc(P.assetUrl(src, P.assetBase))}" alt="" loading="lazy">`;
  }

  function renderEvidence() {
    ensureEvidence();
    const bank = store.lib.evidenceBank;
    const ev = quote.evidence;
    const kindLabel = (kind) => (kind === 'videos' ? 'Videos' : 'Imágenes');

    $('#bankList').innerHTML = ['videos', 'images'].map((kind) => {
      const list = bank[kind] || [];
      return `<div class="bank-group">
        <h4>${kindLabel(kind)} <span class="muted">${list.length}</span></h4>
        ${list.length ? list.map((piece, index) => `
          <div class="bank-row" data-bank-kind="${kind}" data-index="${index}" data-id="${esc(piece.id)}">
            ${bankThumb(kind, piece)}
            <span class="bank-body">
              <span class="bank-title">${esc(piece.title)}</span>
              <span class="bank-meta">${esc(piece.service || 'General')}</span>
            </span>
            <span class="bank-actions">
              <button class="mini" data-action="edit-bank" data-kind="${kind}" data-index="${index}">Reemplazar</button>
              <button class="mini danger" data-action="remove-bank" data-kind="${kind}" data-index="${index}">Quitar</button>
            </span>
          </div>`).join('') : '<p class="bank-empty">Sin piezas.</p>'}
      </div>`;
    }).join('');

    $('#evidenceSelection').innerHTML = ['videos', 'images'].map((kind) => {
      const list = bank[kind] || [];
      const selected = ev.generalIds[kind] || [];
      return `<div class="bank-group">
        <h4>${kindLabel(kind)} <span class="muted">${selected.length}/${list.length}</span></h4>
        ${list.length ? `<div class="select-actions">
          <button class="mini" data-action="select-all" data-kind="${kind}">Seleccionar todo</button>
          <button class="mini" data-action="select-none" data-kind="${kind}">Ninguna</button>
        </div>
        <div class="evidence-checks">
          ${list.map((piece) => `<label class="check-row">
            <input type="checkbox" data-evidence-kind="${kind}" value="${esc(piece.id)}"${selected.includes(piece.id) ? ' checked' : ''}>
            <span>${esc(piece.title)}</span>
          </label>`).join('')}
        </div>` : '<p class="bank-empty">Agrega piezas al banco.</p>'}
      </div>`;
    }).join('');

    $$('[data-mode]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === ev.mode));
    });
    $('[data-action="toggle-new-client"]').setAttribute('aria-pressed', String(ev.mode === 'general'));
    $('#evidenceModeNote').hidden = ev.mode !== 'none';
    $('[data-bank-count]').textContent = String((bank.videos || []).length + (bank.images || []).length);
    updateEvidenceBadge();
  }

  function removeBank(kind, index) {
    const piece = (store.lib.evidenceBank[kind] || [])[index];
    if (!piece) return;
    if (!confirm(`¿Quitar “${piece.title}” del banco? También se quitará de las cotizaciones que la usan.`)) return;
    P.library.removeBankPiece(store.lib, kind, piece.id);
    saveNow();
    refresh();
    renderEvidence();
    toast('Pieza quitada del banco.');
  }

  /* ---------- biblioteca ---------- */

  const esc = P.render.esc;

  function downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateLibraryCount() {
    $$('[data-library-count]').forEach((el) => { el.textContent = String(store.lib.quotes.length); });
  }

  function quoteServices(entry) {
    const names = entry.quote.blocks.map((block) => block.serviceName || block.title);
    return names.filter((value, index, arr) => arr.indexOf(value) === index).join(' + ');
  }

  function renderLibrary() {
    const lib = store.lib;
    $('#libraryList').innerHTML = lib.quotes.map((entry) => {
      const q = entry.quote;
      const url = q.meta.publishedUrl || '';
      const pending = !q.meta.retiredAt && q.meta.retireRequestedAt;
      const state = q.meta.retiredAt ? 'retirada' : (pending ? 'pendiente' : (url ? 'publicada' : 'sin publicar'));
      const stateLabel = state === 'retirada' ? 'Retirada' : (state === 'pendiente' ? 'Retiro pendiente' : (state === 'publicada' ? 'Publicada' : 'Sin publicar'));
      return `<div class="library-row${entry.id === lib.activeId ? ' is-active' : ''}" data-id="${esc(entry.id)}">
        <button class="library-main" data-action="open-quote" data-id="${esc(entry.id)}"${entry.id === lib.activeId ? ' aria-current="true"' : ''}>
          <span class="library-name">${esc(entry.name)}</span>
          <span class="library-meta">${esc(quoteServices(entry))} · ${esc(P.dateLabel(q.meta.date))}</span>
          ${url ? `<span class="library-url">${esc(url)}</span>` : ''}
        </button>
        <span class="status-pill status-${state}">${stateLabel}</span>
        <div class="library-actions">
          ${entry.versions.length ? `<button class="mini" data-action="open-history" data-id="${esc(entry.id)}">Historial (${entry.versions.length})</button>` : ''}
          ${pending ? `<button class="mini" data-action="cancel-retire" data-id="${esc(entry.id)}">Cancelar retiro</button>` : ''}
          ${url && !q.meta.retiredAt && !pending ? `<button class="mini" data-action="retire-quote" data-id="${esc(entry.id)}">Retirar</button>` : ''}
          <button class="mini" data-action="duplicate-quote" data-id="${esc(entry.id)}">Duplicar</button>
          <button class="mini danger" data-action="delete-quote" data-id="${esc(entry.id)}">Eliminar</button>
        </div>
      </div>`;
    }).join('');
    updateLibraryCount();
  }

  function switchQuote(id) {
    if (!id || id === store.lib.activeId) return;
    store.switchTo(id);
    quote = store.quote;
    refresh();
    renderLibrary();
  }

  function backupLibrary() {
    downloadJson(`pandora-biblioteca-${P.todayISO()}.json`, {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeId: store.lib.activeId,
      evidenceBank: store.lib.evidenceBank,
      quotes: store.lib.quotes
    });
    toast('Respaldo descargado. Guárdalo fuera del navegador.');
  }

  function importLibrary(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.version !== 1 || !Array.isArray(data.quotes) || !data.quotes.length) {
          throw new Error('Formato no válido');
        }
        const valid = data.quotes.every((entry) => entry
          && entry.quote
          && entry.quote.meta
          && Array.isArray(entry.quote.blocks)
          && entry.quote.blocks.length);
        if (!valid) throw new Error('Cotizaciones incompletas');
        if (!confirm('¿Reemplazar la biblioteca actual con este respaldo? Las cotizaciones actuales se perderán.')) return;

        try {
          localStorage.setItem(P.library.BACKUP_KEY, JSON.stringify(store.lib));
        } catch (err) {
          // El respaldo es una red de seguridad; si no cabe, la importación sigue.
        }

        const next = P.library.normalize({
          version: 1,
          activeId: data.activeId || data.quotes[0].id,
          evidenceBank: data.evidenceBank || { videos: [], images: [] },
          quotes: data.quotes
        });
        if (!next.quotes.some((entry) => entry.id === next.activeId)) {
          next.activeId = next.quotes[0].id;
        }
        if (!P.library.save(next)) throw new Error('No se pudo guardar el respaldo importado');
        store.lib = next;
        quote = P.library.active(store.lib).quote;
        store.quote = quote;
        refresh();
        renderLibrary();
        toast('Biblioteca importada. El respaldo anterior quedó en este navegador.');
      } catch (err) {
        toast(/guardar/i.test(err.message)
          ? 'No se pudo guardar el respaldo importado. La biblioteca anterior sigue intacta.'
          : 'No pudimos leer ese respaldo. Revisa que sea un JSON exportado desde la matriz.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- publicación ---------- */

  const MODE_LABEL = { service: 'Servicio', general: 'General', both: 'Ambas', none: 'Ocultar' };
  let publishFallback = false;
  let publishMode = 'service';
  const MEDIA_REASON = {
    blob: 'Archivo temporal de esta sesión. Cópialo a docs/assets/media/ y usa su ruta.',
    'data-video': 'Los videos incrustados no se publican. Usa una ruta o un enlace de YouTube/Vimeo.',
    'data-image-size': 'La imagen incrustada pasa de 1.5 MB. Copia el archivo a docs/assets/ y usa su ruta.',
    scheme: 'Ese enlace no es seguro. Usa https:// o una ruta assets/.',
    missing: 'No existe ese archivo dentro de docs/assets/. Revisa la ruta.'
  };

  function pageUrl(slug) {
    return `${P.siteBase || ''}/c/${slug}/`;
  }

  function ensureSlug() {
    if (quote.meta.slug) return quote.meta.slug;
    const client = (quote.meta.client || 'cliente').trim();
    let slug = P.uniqueSlug(client);
    while (store.lib.quotes.some((entry) => entry.quote.meta && entry.quote.meta.slug === slug && entry.id !== quote.id)) {
      slug = P.uniqueSlug(client);
    }
    quote.meta.slug = slug;
    return slug;
  }

  function buildPayload(options) {
    const now = new Date();
    ensureSlug();
    ensureEvidence();
    publishFallback = false;
    let source = quote;

    if (quote.evidence.mode === 'general') {
      const preview = P.buildClientPayload(quote, { bank: store.lib.evidenceBank, now });
      if (!preview.general.videos.length && !preview.general.images.length) {
        publishFallback = true;
        if (options && options.applyFallback) {
          quote.evidence.mode = 'service';
          saveNow();
          refresh();
        } else {
          source = Object.assign({}, quote, {
            evidence: Object.assign({}, quote.evidence, { mode: 'service' })
          });
        }
      }
    }

    publishMode = publishFallback ? 'service' : quote.evidence.mode;
    const payload = P.buildClientPayload(source, { bank: store.lib.evidenceBank, now });
    payload.quote.meta.slug = quote.meta.slug;
    payload.slug = quote.meta.slug;
    return payload;
  }

  function publishServices() {
    return quote.blocks
      .map((block) => block.serviceName || block.title)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(' + ');
  }

  function renderPublish(payload, errors) {
    $('[data-publish="client"]').textContent = quote.meta.client || '';
    $('[data-publish="services"]').textContent = publishServices();
    $('[data-publish="date"]').textContent = P.dateLabel(payload.quote.meta.date);
    $('[data-publish="mode"]').textContent = MODE_LABEL[publishMode] || 'Servicio';
    $('#publishWarning').hidden = !publishFallback;

    const url = pageUrl(payload.slug);
    const link = $('[data-publish-url]');
    link.href = url;
    link.textContent = url;

    const list = $('#publishErrors');
    list.innerHTML = errors.map((error) => `<li>
      <strong>${esc(error.title)}</strong>
      <span>${esc(MEDIA_REASON[error.reason] || 'Revisa esta pieza.')}</span>
      <code>${esc(error.src.length > 90 ? error.src.slice(0, 87) + '…' : error.src)}</code>
    </li>`).join('');
    list.hidden = errors.length === 0;

    const download = $('[data-action="download-package"]');
    download.disabled = errors.length > 0;
    download.setAttribute('aria-disabled', String(errors.length > 0));
  }

  function openPublish() {
    const client = (quote.meta.client || '').trim();
    if (!client) {
      toast('Ponle nombre al cliente antes de exportar.');
      if (!editMode) {
        editMode = true;
        applyEditMode();
      }
      focusPath('meta.client');
      return;
    }
    const payload = buildPayload();
    renderPublish(payload, P.validateMedia(payload));
    $('#publishDialog').showModal();
  }

  function exportStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function downloadPackage() {
    const payload = buildPayload({ applyFallback: true });
    const errors = P.validateMedia(payload);
    if (errors.length) {
      renderPublish(payload, errors);
      return;
    }

    const url = pageUrl(payload.slug);
    const generatedAt = payload.generatedAt;
    payload.quote.meta.date = P.todayISO();
    payload.quote.meta.generatedAt = generatedAt;
    payload.quote.meta.slug = payload.slug;
    payload.quote.meta.publishedUrl = url;
    payload.quote.meta.publishedAt = generatedAt;
    payload.quote.meta.retiredAt = '';
    payload.quote.meta.retireRequestedAt = '';

    const pkg = { kind: 'pandora-cliente', version: 1, ...payload };
    try {
      downloadJson(`pandora-${payload.slug}-${exportStamp()}.json`, pkg);
    } catch (err) {
      toast('No se pudo descargar el paquete. No se marcó como publicada.');
      return;
    }

    quote.meta.date = payload.quote.meta.date;
    quote.meta.generatedAt = generatedAt;
    quote.meta.slug = payload.slug;
    quote.meta.publishedUrl = url;
    quote.meta.publishedAt = generatedAt;
    quote.meta.retiredAt = '';
    quote.meta.retireRequestedAt = '';

    const entry = P.library.update(store.lib, store.lib.activeId, quote);
    P.library.snapshot(store.lib, store.lib.activeId, P.dateLabel(quote.meta.date));
    if (!store.save()) toast('No se pudo guardar en este navegador. Descarga un respaldo.');

    $('#publishDialog').close();
    refresh();
    renderLibrary();
    if (entry) toast('Paquete descargado. Arrástralo sobre «Publicar cliente.command».');
  }

  function cancelRetire(id) {
    const entry = store.lib.quotes.find((item) => item.id === id);
    if (!entry) return;
    entry.quote.meta.retireRequestedAt = '';
    P.library.update(store.lib, entry.id, entry.quote);
    if (entry.id === store.lib.activeId) quote = entry.quote;
    store.save();
    refresh();
    renderLibrary();
    toast('Retiro cancelado en esta biblioteca. Si ya aplicaste el paquete, la página seguirá retirada.');
  }

  function retireQuote(id) {
    const entry = store.lib.quotes.find((item) => item.id === id);
    if (!entry) return;
    const target = entry.quote;
    if (!confirm('La URL dejará de funcionar. La cotización y su historial siguen en esta Mac. ¿Retirar la publicación?')) return;

    const pkg = {
      kind: 'pandora-retiro',
      version: 1,
      slug: target.meta.slug,
      quoteId: target.id,
      client: target.meta.client,
      generatedAt: new Date().toISOString()
    };
    downloadJson(`pandora-retiro-${target.meta.slug}.json`, pkg);
    target.meta.retireRequestedAt = pkg.generatedAt;
    P.library.update(store.lib, entry.id, target);
    if (entry.id === store.lib.activeId) quote = target;
    store.save();
    refresh();
    renderLibrary();
    toast('Retiro descargado. Arrástralo sobre «Publicar cliente.command» para aplicar.');
  }

  let historyCtx = null;

  function openHistory(id) {
    const entry = store.lib.quotes.find((item) => item.id === id);
    if (!entry) return;
    historyCtx = id;
    $('#historySub').textContent = `${entry.name} · ${entry.versions.length} ${entry.versions.length === 1 ? 'versión' : 'versiones'}`;
    $('#historyList').innerHTML = entry.versions.map((version) => `<div class="history-row">
      <span class="history-when">${esc(P.dateLabel(version.quote.meta.date))} · ${esc(P.timeLabel(version.at))}</span>
      <span class="history-label">${esc(version.label || 'Versión')}</span>
      <button class="mini" data-action="restore-version" data-at="${esc(version.at)}">Restaurar</button>
    </div>`).join('');
    $('#historyDialog').showModal();
  }

  function restoreVersion(at) {
    const entry = store.lib.quotes.find((item) => item.id === historyCtx);
    if (!entry) return;
    if (!confirm('¿Restaurar esta versión? Los cambios actuales se reemplazan. La URL publicada no cambia hasta que vuelvas a exportar.')) return;
    P.library.snapshot(store.lib, historyCtx, 'Antes de restaurar');
    const restored = P.library.restore(store.lib, historyCtx, at);
    if (!restored) return;
    if (historyCtx === store.lib.activeId) {
      quote = restored;
      store.quote = quote;
    }
    P.library.save(store.lib);
    refresh();
    renderLibrary();
    $('#historyDialog').close();
    toast('Versión restaurada.');
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
      playVideo(this.dataset.general ? 'general' : Number(this.dataset.block), Number(this.dataset.index));
    },
    lightbox() {
      openLightbox(this.dataset.general ? 'general' : Number(this.dataset.block), Number(this.dataset.index));
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
      if (pickCtx.mode === 'replace') {
        replaceBlock(pickCtx.block, serviceId);
      } else if (pickCtx.mode === 'new') {
        const entry = P.library.add(store.lib, P.newQuote(serviceId));
        quote = entry.quote;
        store.quote = quote;
        saveNow();
        refresh();
        renderLibrary();
        toast('Cotización creada. Edita el nombre del cliente.');
      } else {
        addBlock(serviceId);
      }
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
      if (!confirm('¿Restablecer esta cotización al ejemplo inicial? Se perderán los cambios de este cliente.')) return;
      store.reset();
      quote = store.quote;
      refresh();
      toast('Cotización restablecida.');
    },
    'open-library'() {
      renderLibrary();
      $('#libraryDialog').showModal();
    },
    'close-library'() { $('#libraryDialog').close(); },
    'open-quote'() {
      switchQuote(this.dataset.id);
      $('#libraryDialog').close();
    },
    'new-quote'() {
      $('#libraryDialog').close();
      pickCtx = { mode: 'new' };
      $('#serviceDialog').showModal();
    },
    'duplicate-quote'() {
      const entry = P.library.duplicate(store.lib, this.dataset.id);
      if (!entry) return;
      quote = entry.quote;
      store.quote = quote;
      saveNow();
      refresh();
      renderLibrary();
      toast('Cotización duplicada.');
    },
    'delete-quote'() {
      const id = this.dataset.id;
      const entry = store.lib.quotes.find((item) => item.id === id);
      if (!entry) return;
      const warning = entry.quote.meta.publishedUrl
        ? ' Esta cotización tiene una página publicada: eliminarla aquí no borra esa página.'
        : '';
      if (!confirm(`¿Eliminar “${entry.name}” de esta Mac?${warning}`)) return;
      if (!P.library.remove(store.lib, id)) {
        toast('Debe quedar al menos una cotización. Crea otra antes de eliminar esta.');
        return;
      }
      if (!store.lib.quotes.some((item) => item.id === store.lib.activeId)) {
        store.lib.activeId = store.lib.quotes[0].id;
      }
      P.library.save(store.lib);
      quote = P.library.active(store.lib).quote;
      store.quote = quote;
      refresh();
      renderLibrary();
      toast('Cotización eliminada de este navegador.');
    },
    'open-publish'() { openPublish(); },
    'close-publish'() { $('#publishDialog').close(); },
    'download-package'() { downloadPackage(); },
    'retire-quote'() { retireQuote(this.dataset.id); },
    'cancel-retire'() { cancelRetire(this.dataset.id); },
    'open-history'() { openHistory(this.dataset.id); },
    'close-history'() { $('#historyDialog').close(); },
    'restore-version'() { restoreVersion(this.dataset.at); },
    'backup-library'() { backupLibrary(); },
    'import-library'() { $('#libraryFile').click(); },
    'open-evidence'() {
      renderEvidence();
      $('#evidenceDialog').showModal();
    },
    'close-evidence'() { $('#evidenceDialog').close(); },
    'evidence-mode'() {
      ensureEvidence();
      quote.evidence.mode = this.dataset.mode;
      saveNow();
      refresh();
      renderEvidence();
    },
    'toggle-new-client'() {
      ensureEvidence();
      const ev = quote.evidence;
      if (ev.mode === 'general') {
        ev.mode = 'service';
      } else {
        ev.mode = 'general';
        const bank = store.lib.evidenceBank;
        if (!ev.generalIds.videos.length && !ev.generalIds.images.length) {
          ev.generalIds.videos = (bank.videos || []).map((piece) => piece.id);
          ev.generalIds.images = (bank.images || []).map((piece) => piece.id);
        }
      }
      saveNow();
      refresh();
      renderEvidence();
    },
    'add-bank'() { openMediaDialog({ bank: true, kind: this.dataset.kind }); },
    'edit-bank'() { openMediaDialog({ bank: true, kind: this.dataset.kind, index: Number(this.dataset.index) }); },
    'remove-bank'() { removeBank(this.dataset.kind, Number(this.dataset.index)); },
    'select-all'() {
      ensureEvidence();
      const kind = this.dataset.kind;
      quote.evidence.generalIds[kind] = (store.lib.evidenceBank[kind] || []).map((piece) => piece.id);
      saveNow();
      refresh();
      renderEvidence();
    },
    'select-none'() {
      ensureEvidence();
      quote.evidence.generalIds[this.dataset.kind] = [];
      saveNow();
      refresh();
      renderEvidence();
    }
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

    }, true);

    document.addEventListener('change', (event) => {
      const box = event.target.closest('[data-evidence-kind]');
      if (box) {
        ensureEvidence();
        const kind = box.dataset.evidenceKind;
        const ids = new Set(quote.evidence.generalIds[kind]);
        if (box.checked) ids.add(box.value);
        else ids.delete(box.value);
        quote.evidence.generalIds[kind] = Array.from(ids);
        saveNow();
        refresh();
        renderEvidence();
        return;
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

    $('#libraryFile').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) importLibrary(file);
      event.target.value = '';
    });

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
    updateLibraryCount();
    P.render.all(quote, renderOptions());
    renderEvidence();
    bind();
    applyEditMode();
    observeSections();
    document.body.classList.add('ready');
    window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
