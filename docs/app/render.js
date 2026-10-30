/* Render del documento: capítulos por servicio, inversión, condiciones y utilidades de formato.
   El mismo render sirve a la matriz (editable) y a la versión cliente (readonly). */
(function () {
  'use strict';

  const DEFAULT_OPTS = {
    readonly: false,
    view: 'editor',
    evidenceMode: 'service',
    general: { videos: [], images: [] }
  };

  let OPTS = Object.assign({}, DEFAULT_OPTS);

  const esc = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const asset = (src) => (P.assetUrl ? P.assetUrl(src, P.assetBase) : src);

  // Títulos que no aportan nada en la página: nombres de archivo y etiquetas
  // genéricas. En el panel se siguen viendo para poder editarlos.
  const GENERIC_CAPTION = /^(video|vídeo|imagen|foto|pieza|sin título|sin titulo)$/i;
  const FILE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|mp4|mov|m4v|webm|svg)$/i;
  const FILE_NAME = /_\d{9,}_|^\d{9,}(?:_|$)|^(?:img|dsc|pxl|vid)[-_ ]?\d|^(?:whatsapp|screenshot|captura|photo)\b|^screen shot\b/i;

  function captionText(title) {
    const text = String(title == null ? '' : title).trim();
    if (!text || GENERIC_CAPTION.test(text) || FILE_EXT.test(text) || FILE_NAME.test(text)) return '';
    return text;
  }

  function capStatic(title) {
    const text = captionText(title);
    return text ? `<figcaption class="shot-cap"><span class="txt">${esc(text)}</span></figcaption>` : '';
  }

  function capEditable(path, title, extra) {
    if (isRO()) return capStatic(title);
    return `<figcaption class="shot-cap">${txt(path, title)}${extra || ''}</figcaption>`;
  }

  const altText = (title, fallback) => esc(captionText(title) || fallback);

  const isRO = () => OPTS.readonly || OPTS.view === 'client';

  const ed = (path, value, cls) =>
    `<span class="editable${cls ? ' ' + cls : ''}" data-text="${path}">${esc(value)}</span>`;

  const txt = (path, value, cls) => (isRO()
    ? `<span class="txt${cls ? ' ' + cls : ''}">${esc(value)}</span>`
    : ed(path, value, cls));

  const editOnly = (html) => (isRO() ? '' : html);

  function embedUrl(src) {
    if (!src) return null;
    const yt = src.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return 'https://www.youtube-nocookie.com/embed/' + yt[1] + '?autoplay=1&rel=0&modestbranding=1';
    const vm = src.match(/vimeo\.com\/(\d+)/);
    if (vm) return 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1';
    return null;
  }

  function initials(title) {
    return String(title || '').trim().slice(0, 1).toUpperCase();
  }

  const isEditor = () => !isRO() && OPTS.view === 'editor';

  function showsService() {
    if (isEditor()) return true;
    return OPTS.evidenceMode === 'service' || OPTS.evidenceMode === 'both';
  }

  function generalPieces() {
    const general = OPTS.general || {};
    return { videos: general.videos || [], images: general.images || [] };
  }

  function hasGeneral() {
    const pieces = generalPieces();
    return pieces.videos.length + pieces.images.length > 0;
  }

  function showsGeneral() {
    if (!hasGeneral()) return false;
    if (isEditor()) return true;
    return OPTS.evidenceMode === 'general' || OPTS.evidenceMode === 'both';
  }

  function generalSection(num) {
    const pieces = generalPieces();
    const hidden = isEditor() && (OPTS.evidenceMode === 'service' || OPTS.evidenceMode === 'none');
    const counts = `${pieces.videos.length} videos · ${pieces.images.length} piezas`;
    return `<section class="section section-work section-general" id="otros-trabajos" aria-labelledby="h-general">
      <header class="section-head">
        <span class="num">${num}</span>
        <h2 id="h-general">Otros trabajos</h2>
        <span class="head-rule" aria-hidden="true"></span>
        <span class="head-note">${counts}${hidden ? ' · <span class="mode-badge">Oculto en la versión cliente</span>' : ''}</span>
      </header>

      <div class="work-grid">
        ${pieces.videos.map((video, vi) => `
          <figure class="shot shot-${vi % 2 === 0 ? 'a' : 'b'}" data-video data-general="1" data-index="${vi}">
            <div class="shot-frame">
              ${video.poster
                ? `<img src="${esc(asset(video.poster))}" alt="" loading="lazy" draggable="false">`
                : `<div class="shot-empty">Sin portada</div>`}
              <button class="play" data-action="play-video" data-general="1" data-index="${vi}"
                      aria-label="Reproducir ${esc(video.title || 'video')}">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
                <span>Reproducir</span>
              </button>
              <span class="shot-tag">Video</span>
            </div>
            ${capStatic(video.title)}
          </figure>`).join('')}

        ${pieces.images.map((image, ii) => `
          <figure class="still" data-image>
            <button class="still-link" data-action="lightbox" data-general="1" data-index="${ii}"
                    aria-label="Ampliar ${altText(image.title, 'pieza')}">
              <img src="${esc(asset(image.src))}" alt="${altText(image.title, 'Evidencia de trabajo')}" loading="lazy" draggable="false">
            </button>
            ${capStatic(image.title)}
          </figure>`).join('')}
      </div>

      <p class="work-note print-only">Los videos completos están disponibles en la versión interactiva de esta cotización.</p>

      <div class="print-stats print-only">
        <div><span>Evidencia</span><strong>${counts}</strong></div>
      </div>
    </section>`;
  }

  function updateNav() {
    const evidence = document.querySelector('[data-nav][href="#evidencia"]');
    if (evidence) evidence.hidden = !showsService();
    const general = document.querySelector('[data-nav][href="#otros-trabajos"]');
    if (general) general.hidden = !showsGeneral();
  }

  /* ---------- capítulos ---------- */

  function renderChapters(quote) {
    const host = document.getElementById('chapters');
    if (!host) return null;

    let n = 0;
    const nextNum = () => String(++n).padStart(2, '0');
    let html = '';
    const withEvidence = showsService();
    const hiddenService = isEditor() && (OPTS.evidenceMode === 'general' || OPTS.evidenceMode === 'none');

    quote.blocks.forEach((block, bi) => {
      const first = bi === 0;
      const alcanceId = first ? 'alcance' : 'alcance-' + bi;
      const evidenciaId = first ? 'evidencia' : 'evidencia-' + bi;

      html += `<section class="section section-scope" id="${alcanceId}" data-block="${bi}" aria-labelledby="h-scope-${bi}">
        <header class="section-head">
          <span class="num">${nextNum()}</span>
          <h2 id="h-scope-${bi}">Alcance del servicio</h2>
          <span class="head-rule" aria-hidden="true"></span>
          <span class="head-note">${esc(block.duration || '')}</span>
        </header>

        <div class="scope-grid">
          <div class="scope-intro">
            <h3 class="scope-title">${txt(`blocks.${bi}.title`, block.title)}</h3>
            <p class="scope-tagline">${txt(`blocks.${bi}.tagline`, block.tagline)}</p>
            <div class="scope-badge">
              <span class="badge-mark" aria-hidden="true">✦</span>
              <span>${esc((block.items || []).length)} ítems en la inversión</span>
            </div>
          </div>

          <div class="scope-body">
            <ul class="deliverables" data-list="blocks.${bi}.deliverables">
              ${(block.deliverables || []).map((item, ii) => `
                <li class="deliv">
                  <span class="bullet" aria-hidden="true"></span>
                  ${txt(`blocks.${bi}.deliverables.${ii}`, item)}
                  ${editOnly(`<button class="row-remove edit-only" data-action="remove-entry"
                          data-list="blocks.${bi}.deliverables" data-index="${ii}"
                          aria-label="Quitar entrega">✕</button>`)}
                </li>`).join('')}
            </ul>
            ${editOnly(`<button class="add-entry edit-only" data-action="add-entry"
                    data-list="blocks.${bi}.deliverables" data-placeholder="Nueva entrega">
              <span aria-hidden="true">+</span> Añadir entrega
            </button>`)}

            <div class="notes">
              <h4>Consideraciones</h4>
              <ul class="note-list" data-list="blocks.${bi}.considerations">
                ${(block.considerations || []).map((item, ii) => `
                  <li class="note">
                    ${txt(`blocks.${bi}.considerations.${ii}`, item)}
                    ${editOnly(`<button class="row-remove edit-only" data-action="remove-entry"
                            data-list="blocks.${bi}.considerations" data-index="${ii}"
                            aria-label="Quitar consideración">✕</button>`)}
                  </li>`).join('')}
              </ul>
              ${editOnly(`<button class="add-entry edit-only" data-action="add-entry"
                      data-list="blocks.${bi}.considerations" data-placeholder="Nueva consideración">
                <span aria-hidden="true">+</span> Añadir consideración
              </button>`)}
            </div>
          </div>
        </div>
        <div class="process">
          <h4>Cómo trabajamos</h4>
          <ol>
            ${(block.process || []).map((step, si) => `
              <li>
                <span class="step-num">${String(si + 1).padStart(2, '0')}</span>
                <h5 class="step-title">${txt(`blocks.${bi}.process.${si}.title`, step.title)}</h5>
                <p class="step-detail">${txt(`blocks.${bi}.process.${si}.detail`, step.detail)}</p>
              </li>`).join('')}
          </ol>
        </div>

        <div class="print-stats print-only">
          <div><span>Duración</span><strong>${esc(block.duration || '')}</strong></div>
          <div><span>Entregables</span><strong>${(block.deliverables || []).length}</strong></div>
          ${withEvidence ? `<div><span>Evidencia</span><strong>${(block.videos || []).length} videos · ${(block.images || []).length} piezas</strong></div>` : ''}
          <div><span>Inversión</span><strong><span data-block-total="${bi}"></span><span class="stat-tax" data-tax-suffix> + IGV</span></strong></div>
        </div>
      </section>`;

      if (withEvidence) {
        html += `<section class="section section-work" id="${evidenciaId}" data-block="${bi}" aria-labelledby="h-work-${bi}">
          <header class="section-head">
            <span class="num">${nextNum()}</span>
            <h2 id="h-work-${bi}">Evidencia de trabajo</h2>
            <span class="head-rule" aria-hidden="true"></span>
            <span class="head-note">${(block.videos || []).length} videos · ${(block.images || []).length} piezas${hiddenService ? ' · <span class="mode-badge">Oculto en la versión cliente</span>' : ''}</span>
          </header>

          <div class="work-grid">
            ${(block.videos || []).map((video, vi) => `
              <figure class="shot shot-${vi % 2 === 0 ? 'a' : 'b'}" data-video data-block="${bi}" data-index="${vi}">
                <div class="shot-frame">
                  ${video.poster
                    ? `<img src="${esc(asset(video.poster))}" alt="" loading="lazy" draggable="false">`
                    : `<div class="shot-empty">Sin portada</div>`}
                  <button class="play" data-action="play-video" data-block="${bi}" data-index="${vi}"
                          aria-label="Reproducir ${esc(video.title || 'video')}">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
                    <span>Reproducir</span>
                  </button>
                  <span class="shot-tag">Video</span>
                </div>
                ${capEditable(`blocks.${bi}.videos.${vi}.title`, video.title, editOnly(`<button class="mini edit-only" data-action="edit-media" data-block="${bi}" data-kind="videos" data-index="${vi}">Reemplazar</button>`))}
              </figure>`).join('')}

            ${(block.images || []).map((image, ii) => `
              <figure class="still" data-image>
                <button class="still-link" data-action="lightbox" data-block="${bi}" data-index="${ii}"
                        aria-label="Ampliar ${altText(image.title, 'pieza')}">
                  <img src="${esc(asset(image.src))}" alt="${altText(image.title, 'Evidencia de trabajo')}" loading="lazy" draggable="false">
                </button>
                ${capEditable(`blocks.${bi}.images.${ii}.title`, image.title, editOnly(`<button class="mini edit-only" data-action="edit-media" data-block="${bi}" data-kind="images" data-index="${ii}">Reemplazar</button>`))}
              </figure>`).join('')}
          </div>

          <p class="work-note print-only">Los videos completos están disponibles en la versión interactiva de esta cotización.</p>

          ${editOnly(`<div class="work-foot edit-only">
            <button class="btn small ghost" data-action="add-media" data-block="${bi}" data-kind="videos">+ Añadir video</button>
            <button class="btn small ghost" data-action="add-media" data-block="${bi}" data-kind="images">+ Añadir imagen</button>
            <button class="btn small ghost" data-action="change-service" data-block="${bi}">Cambiar servicio</button>
            ${quote.blocks.length > 1 ? `<button class="btn small ghost danger" data-action="remove-block" data-block="${bi}">Quitar este servicio</button>` : ''}
          </div>`)}
        </section>`;
      }
    });

    if (showsGeneral()) html += generalSection(nextNum());

    host.innerHTML = html;
    updateNav();

    const inversion = document.querySelector('#inversion .num');
    if (inversion) inversion.textContent = nextNum();
    const conditions = document.querySelector('#condiciones .num');
    if (conditions) conditions.textContent = nextNum();
    return n;
  }

  /* ---------- inversión ---------- */

  function renderPrices(quote) {
    const host = document.getElementById('price-groups');
    if (!host) return;
    const multi = quote.blocks.length > 1;

    host.innerHTML = quote.blocks.map((block, bi) => {
      const sum = (block.items || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      return `<div class="price-group">
        <div class="price-group-head">
          <h3>${esc(block.serviceName || (P.catalog && P.catalog[block.serviceId] ? P.catalog[block.serviceId].name : block.title))}</h3>
          ${multi ? `<span class="group-sum">S/ ${P.money(sum)}</span>` : ''}
        </div>
        <div class="price-rows">
          ${(block.items || []).map((item, ii) => `
            <div class="price-row">
              ${txt(`blocks.${bi}.items.${ii}.label`, item.label, 'price-name')}
              <span class="leader" aria-hidden="true"></span>
              <span class="price-amt">
                <span class="cur">S/</span>
                ${isRO()
                  ? `<span class="amt-txt">${P.money(item.amount)}</span>`
                  : `<input class="amt" type="text" inputmode="decimal" spellcheck="false"
                       data-amount="blocks.${bi}.items.${ii}.amount" value="${P.money(item.amount)}"
                       style="width:${Math.max(5, P.money(item.amount).length)}ch"
                       aria-label="Monto de ${esc(item.label)}">`}
              </span>
              ${editOnly(`<button class="row-remove edit-only" data-action="remove-entry"
                      data-list="blocks.${bi}.items" data-index="${ii}" aria-label="Quitar ítem">✕</button>`)}
            </div>`).join('')}
        </div>
        ${editOnly(`<button class="add-line edit-only" data-action="add-line" data-block="${bi}" data-kind="items">
          <span aria-hidden="true">+</span> Añadir línea de inversión
        </button>`)}
      </div>`;
    }).join('');
  }

  function renderSplit(quote) {
    const payments = quote.meta.payments || [];
    const total = P.totals(quote).grand;
    const tones = ['var(--purple)', 'var(--mint)', 'var(--sky)', 'var(--sand)'];

    document.querySelectorAll('[data-split-bar]').forEach((bar) => {
      bar.innerHTML = payments.map((payment, i) => {
        const pct = Number(payment.pct) || 0;
        return `<span style="width:${pct}%;background:${tones[i % tones.length]}"
                      title="${esc(payment.label)}: ${pct}%"></span>`;
      }).join('');
    });

    const host = document.getElementById('paylist');
    if (!host) return;
    host.innerHTML = payments.map((payment, i) => {
      const pct = Number(payment.pct) || 0;
      return `<li>
        <span class="pay-pct">
          ${isRO()
            ? `${pct}%`
            : `<input class="pct-input" type="text" inputmode="decimal" data-pct="meta.payments.${i}.pct"
                     value="${pct}" aria-label="Porcentaje del pago">%`}
        </span>
        <span class="pay-label">${txt(`meta.payments.${i}.label`, payment.label)}</span>
        <span class="pay-amt">S/ ${P.money(total * pct / 100)}</span>
      </li>`;
    }).join('');
  }

  function renderBank(quote) {
    const bank = quote.bank || {};
    const rows = [
      ['Banco', 'bankName', bank.bankName, false],
      ['Titular', 'holder', bank.holder, false],
      ['Cuenta corriente', 'account', bank.account, true],
      ['CCI', 'cci', bank.cci, true],
      ['Detracciones', 'detractions', bank.detractions, true]
    ];
    const host = document.getElementById('bank');
    if (!host) return;
    host.innerHTML = rows.map(([label, key, value, copy]) => `
      <div class="bank-row">
        <dt>${label}</dt>
        <dd>${txt('bank.' + key, value)}</dd>
        ${copy ? editOnly(`<button class="copy edit-only" data-action="copy" data-copy="${esc(value)}" aria-label="Copiar ${label}">Copiar</button>`) : ''}
      </div>`).join('');
  }

  function renderConditions(quote) {
    const host = document.getElementById('conditions');
    if (!host) return;
    host.innerHTML = `<ol class="conditions" data-list="meta.conditions">
      ${(quote.meta.conditions || []).map((item, i) => `
        <li>
          <span class="cond-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          ${txt(`meta.conditions.${i}`, item)}
          ${editOnly(`<button class="row-remove edit-only" data-action="remove-entry"
                  data-list="meta.conditions" data-index="${i}" aria-label="Quitar condición">✕</button>`)}
        </li>`).join('')}
    </ol>
    ${editOnly(`<button class="add-entry edit-only" data-action="add-entry" data-list="meta.conditions" data-placeholder="Nueva condición">
      <span aria-hidden="true">+</span> Añadir condición
    </button>`)}`;
  }

  function renderPicker(quote) {
    const host = document.getElementById('servicePicker');
    if (!host || isRO()) return;
    const used = new Set(quote.blocks.map((block) => block.serviceId));
    host.innerHTML = Object.values(P.catalog).map((service) => `
      <button class="pick" data-action="pick-service" data-service="${service.id}">
        <span class="pick-mark">${esc(initials(service.name))}</span>
        <span class="pick-body">
          <span class="pick-name">${esc(service.name)}</span>
          <span class="pick-desc">${esc(service.tagline)}</span>
        </span>
        <span class="pick-state">${used.has(service.id) ? 'Ya incluido' : 'Añadir'}</span>
      </button>`).join('');
  }

  /* ---------- valores derivados ---------- */

  function derived(quote) {
    const t = P.totals(quote);
    const services = quote.blocks
      .map((block) => (block.serviceName || (P.catalog && P.catalog[block.serviceId] ? P.catalog[block.serviceId].name : block.title)))
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(' + ');
    const payments = quote.meta.payments || [];
    const split = payments.map((payment) => `${Number(payment.pct) || 0}% ${String(payment.label).toLowerCase()}`).join(' · ');
    return {
      'summary.services': services,
      'summary.igvPct': quote.meta.taxEnabled ? `(${quote.meta.taxRate}%)` : '',
      'summary.taxNote': quote.meta.taxEnabled
        ? `Incluye I.G.V. (${quote.meta.taxRate}%)`
        : 'No incluye I.G.V.',
      'summary.taxNoteShort': quote.meta.taxEnabled
        ? `Precios en soles · I.G.V. ${quote.meta.taxRate}% incluido`
        : 'Precios en soles · I.G.V. no incluido',
      'summary.split': split,
      'summary.grand': P.moneyS(t.grand)
    };
  }

  function sync(quote) {
    const values = derived(quote);

    document.querySelectorAll('[data-text]').forEach((el) => {
      const path = el.dataset.text;
      const value = values[path] !== undefined ? values[path] : P.get(quote, path);
      if (value === undefined || value === null) return;
      if (el.textContent !== String(value)) el.textContent = value;
    });

    document.querySelectorAll('[data-field]').forEach((el) => {
      const value = P.get(quote, el.dataset.field);
      if (value !== undefined && value !== null) el.textContent = value;
    });

    document.querySelectorAll('[data-summary]').forEach((el) => {
      const value = values['summary.' + el.dataset.summary];
      if (value !== undefined && value !== null) el.textContent = value;
    });

    const t = P.totals(quote);
    document.querySelectorAll('[data-total]').forEach((el) => {
      const key = el.dataset.total;
      const value = key === 'grand' ? t.grand : key === 'subtotal' ? t.subtotal : t.igv;
      el.textContent = P.moneyS(value);
    });

    document.querySelectorAll('[data-igv-row]').forEach((el) => {
      el.toggleAttribute('hidden', !quote.meta.taxEnabled);
    });

    document.querySelectorAll('[data-block-total]').forEach((el) => {
      const block = quote.blocks[Number(el.dataset.blockTotal)];
      if (!block) return;
      const sum = (block.items || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      el.textContent = P.moneyS(sum);
    });

    document.querySelectorAll('[data-tax-suffix]').forEach((el) => {
      el.hidden = !quote.meta.taxEnabled;
    });

    const dateEl = document.querySelector('[data-date]');
    if (dateEl) {
      dateEl.textContent = P.dateLabel(quote.meta.date);
      dateEl.setAttribute('datetime', quote.meta.date || '');
    }
    const todayEl = document.querySelector('[data-date-today]');
    if (todayEl) {
      const iso = P.todayISO();
      todayEl.textContent = P.dateLabel(iso);
      todayEl.setAttribute('datetime', iso);
    }

    document.querySelectorAll('.amt').forEach((input) => {
      if (document.activeElement !== input) {
        const value = P.money(P.get(quote, input.dataset.amount));
        input.value = value;
        input.style.width = Math.max(5, value.length) + 'ch';
      }
    });
    document.querySelectorAll('.pct-input').forEach((input) => {
      if (document.activeElement !== input) input.value = P.get(quote, input.dataset.pct);
    });
  }

  function renderAll(quote, opts) {
    OPTS = Object.assign({}, DEFAULT_OPTS, opts || {});
    renderChapters(quote);
    if (!document.getElementById('chapters')) updateNav();
    renderPrices(quote);
    renderSplit(quote);
    renderBank(quote);
    renderConditions(quote);
    renderPicker(quote);
    sync(quote);
  }

  P.render = {
    all: renderAll,
    sync,
    prices: renderPrices,
    split: renderSplit,
    bank: renderBank,
    conditions: renderConditions,
    picker: renderPicker,
    embedUrl,
    esc,
    captionText
  };
})();
