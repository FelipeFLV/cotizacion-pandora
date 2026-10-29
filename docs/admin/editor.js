/* Editor por secciones con autoguardado. Todo son campos planos. */
(function (root) {
  'use strict';

  const PADMIN = root.PADMIN;
  const F = PADMIN.form;
  const M = PADMIN.editorModel;
  const esc = F.esc;

  const DELAY = 800;

  let host = null;
  let current = null;
  let onChange = null;
  let save = null;
  let timer = null;
  let statusNode = null;
  let savedAt = '';
  let lastError = '';
  let bank = [];
  let signedMap = {};

  function hhmm() {
    const now = new Date();
    return [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(':');
  }

  function status(text, kind, canRetry) {
    if (!statusNode) return;
    const retry = canRetry == null ? kind === 'error' : canRetry;
    statusNode.innerHTML = `${esc(text)}${retry ? ' <button class="mini" data-op="retry-save" type="button">Reintentar</button>' : ''}`;
    statusNode.dataset.kind = kind || '';
    statusNode.hidden = !text;
  }

  function money(value) {
    return F.esc(root.P.moneyS(value));
  }

  function section(id, title, body, extra) {
    return `<section class="edit-section" id="sec-${id}">
      <header class="edit-section-head">
        <h3>${esc(title)}</h3>
        ${extra || ''}
      </header>
      ${body}
    </section>`;
  }

  function clientSection() {
    const meta = current.meta || {};
    return section('cliente', 'Cliente', `<div class="grid-2">
      ${F.text({ path: 'meta.client', label: 'Cliente', value: meta.client })}
      ${F.text({ path: 'meta.quoteNo', label: 'N.º de cotización', value: meta.quoteNo })}
      ${F.date({ path: 'meta.date', label: 'Fecha', value: meta.date })}
      ${F.text({ path: 'meta.duration', label: 'Duración', value: meta.duration })}
      ${F.text({ path: 'meta.validity', label: 'Vigencia', value: meta.validity })}
      ${F.text({ path: 'meta.taxRate', label: 'IGV (%)', value: meta.taxRate, type: 'number' })}
      ${F.textarea({ path: 'meta.lede', label: 'Entradilla', value: meta.lede, rows: 3 })}
      ${F.textarea({ path: 'meta.closing', label: 'Cierre', value: meta.closing, rows: 3 })}
      ${F.check({ path: 'meta.taxEnabled', label: 'Aplicar IGV', checked: meta.taxEnabled })}
    </div>`);
  }

  function blockSection(block, index) {
    const base = `blocks.${index}`;
    const lines = (block.items || []).map((item, itemIndex) => `<tr>
      <td><input data-field="${base}.items.${itemIndex}.concept" value="${esc(item.concept)}" aria-label="Concepto"></td>
      <td class="cell-money"><span class="money-wrap"><em>S/</em><input data-field="${base}.items.${itemIndex}.amount" type="number" step="0.01" min="0" value="${esc(item.amount)}" aria-label="Monto"></span></td>
      <td class="cell-tools"><button class="mini" data-op="item-del" data-index="${index}" data-item="${itemIndex}" type="button" aria-label="Quitar línea">×</button></td>
    </tr>`).join('');

    return `<article class="block-edit" data-block="${index}">
      <header class="block-edit-head">
        <input class="block-title" data-field="${base}.title" value="${esc(block.title)}" aria-label="Título del servicio">
        <div class="block-tools">
          <button class="mini" data-op="block-up" data-index="${index}" type="button" aria-label="Subir servicio">↑</button>
          <button class="mini" data-op="block-down" data-index="${index}" type="button" aria-label="Bajar servicio">↓</button>
          <button class="mini" data-op="block-dup" data-index="${index}" type="button">Duplicar</button>
          <button class="mini mini-quiet" data-op="block-del" data-index="${index}" type="button">Eliminar</button>
        </div>
      </header>
      <div class="grid-2">
        ${F.text({ path: `${base}.tagline`, label: 'Bajada', value: block.tagline })}
        ${F.text({ path: `${base}.duration`, label: 'Duración', value: block.duration })}
        ${F.list({ path: `${base}.deliverables`, label: 'Entregables', items: block.deliverables })}
        ${F.list({ path: `${base}.considerations`, label: 'Consideraciones', items: block.considerations })}
        ${F.list({ path: `${base}.process`, label: 'Proceso', items: block.process })}
      </div>
      <div class="items-edit">
        <span class="items-title">Líneas de inversión</span>
        <table class="items-table">
          <tbody>${lines || '<tr><td colspan="3" class="items-empty">Sin líneas.</td></tr>'}</tbody>
        </table>
        <button class="mini" data-op="item-add" data-index="${index}" type="button">Añadir línea</button>
      </div>
    </article>`;
  }

  function servicesSection() {
    const blocks = (current.blocks || []).map((block, index) => blockSection(block, index)).join('');
    return section('servicios', 'Servicios', `<div class="blocks">${blocks}</div>
      <button class="mini" data-op="block-add" type="button">Añadir servicio</button>`);
  }

  function investmentSection() {
    const totals = M.totals(current);
    const meta = current.meta || {};
    const payments = (meta.payments || []).map((payment, index) => `<tr>
      <td><input data-field="meta.payments.${index}.label" value="${esc(payment.label)}" aria-label="Etiqueta del pago"></td>
      <td class="cell-pct"><input data-field="meta.payments.${index}.pct" type="number" step="any" min="0" value="${esc(payment.pct)}" aria-label="Porcentaje"> <em>%</em></td>
      <td class="cell-tools"><button class="mini" data-op="pay-del" data-index="${index}" type="button" aria-label="Quitar pago">×</button></td>
    </tr>`).join('');
    const total = M.paymentTotal(current);
    return section('inversion', 'Inversión', `<dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>
        <div><dt>IGV (${esc(totals.rate)}%)</dt><dd>${money(totals.igv)}</dd></div>
        <div class="totals-grand"><dt>Total</dt><dd data-total>${money(totals.grand)}</dd></div>
      </dl>
      <div class="payments">
        <span class="items-title">Pagos</span>
        <table class="items-table"><tbody>${payments || '<tr><td colspan="3" class="items-empty">Sin pagos.</td></tr>'}</tbody></table>
        <p class="pay-note${total === 100 ? '' : ' is-bad'}">Suma actual: <strong data-pay-total>${total}</strong>%${total === 100 ? '' : ' · debe sumar 100%'}</p>
        <button class="mini" data-op="pay-add" type="button">Añadir pago</button>
      </div>`);
  }

  function conditionsSection() {
    const meta = current.meta || {};
    const bank = current.bank || {};
    const items = (meta.conditions || []).map((condition, index) => `<tr>
      <td><input data-field="meta.conditions.${index}" value="${esc(condition)}" aria-label="Condición"></td>
      <td class="cell-tools"><button class="mini" data-op="cond-del" data-index="${index}" type="button" aria-label="Quitar condición">×</button></td>
    </tr>`).join('');
    return section('condiciones', 'Condiciones y banco', `<table class="items-table"><tbody>${items}</tbody></table>
      <button class="mini" data-op="cond-add" type="button">Añadir condición</button>
      <div class="grid-2 bank-grid">
        ${F.text({ path: 'bank.holder', label: 'Titular', value: bank.holder })}
        ${F.text({ path: 'bank.bankName', label: 'Banco', value: bank.bankName })}
        ${F.text({ path: 'bank.account', label: 'Cuenta', value: bank.account })}
        ${F.text({ path: 'bank.cci', label: 'CCI', value: bank.cci })}
        ${F.text({ path: 'bank.detractions', label: 'Detracciones', value: bank.detractions })}
      </div>`);
  }

  function evidenceSection() {
    const body = PADMIN.evidence
      ? PADMIN.evidence.render({ quote: current, bank, signedMap })
      : '<p class="section-note">El gestor de evidencias no está disponible.</p>';
    return section('evidencias', 'Evidencias', body);
  }

  function publishSection() {
    const body = PADMIN.publish
      ? PADMIN.publish.render({ quote: current })
      : `<div class="publish-box" id="publish-box"></div>`;
    return section('publicacion', 'Publicación', body);
  }

  function body() {
    return `<div class="edit-bar">
        <span class="save-status" id="save-status" hidden></span>
      </div>
      <div class="sections">
        ${clientSection()}
        ${servicesSection()}
        ${evidenceSection()}
        ${investmentSection()}
        ${conditionsSection()}
        ${publishSection()}
      </div>`;
  }

  function render() {
    if (!host) return;
    host.innerHTML = body();
    statusNode = host.querySelector('#save-status');
    if (savedAt) status(`Guardado · ${savedAt}`, '');
    else if (lastError) status('Error al guardar', 'error');
  }

  function refresh(quote) {
    current = quote;
    render();
  }

  function repaintPublish() {
    if (!host) return;
    const sectionNode = host.querySelector('#sec-publicacion');
    if (!sectionNode) return render();
    sectionNode.outerHTML = publishSection();
  }

  function updateComputed() {
    if (!host) return;
    const totals = M.totals(current);
    const totalNode = host.querySelector('[data-total]');
    if (totalNode) totalNode.textContent = root.P.moneyS(totals.grand);
    const payTotal = host.querySelector('[data-pay-total]');
    if (payTotal) {
      const total = M.paymentTotal(current);
      payTotal.textContent = total;
      const note = payTotal.closest('.pay-note');
      if (note) note.classList.toggle('is-bad', total !== 100);
    }
  }

  function coerce(field, input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number') return input.value === '' ? 0 : Number(input.value);
    if (input.dataset.kind === 'lines') {
      return input.value.split('\n').map((line) => line.trim()).filter(Boolean);
    }
    return input.value;
  }

  function scheduleSave() {
    root.clearTimeout(timer);
    status('Guardando…', 'busy');
    timer = root.setTimeout(flush, DELAY);
  }

  async function flush() {
    root.clearTimeout(timer);
    timer = null;
    if (!save || !current) return;
    const snapshot = JSON.parse(JSON.stringify(current));
    try {
      await save(snapshot);
      savedAt = hhmm();
      lastError = '';
      status(`Guardado · ${savedAt}`, '');
    } catch (error) {
      lastError = String(error && error.message ? error.message : error);
      status('Error al guardar', 'error');
    }
  }

  function onInput(event) {
    const field = event.target.closest('[data-field]');
    if (!field) return;
    current = M.setPath(current, field.dataset.field, coerce(field.dataset.field, field));
    updateComputed();
    if (onChange) onChange(current);
    scheduleSave();
  }

  function storagePath(path) {
    const match = String(path || '').match(/^blocks\.(\d+)\./);
    return match ? Number(match[1]) : -1;
  }

  function serviceName(path) {
    const index = storagePath(path);
    const block = index >= 0 && current.blocks ? current.blocks[index] : null;
    return block ? block.title || '' : '';
  }

  function evError(path, message) {
    if (!host || !path) return;
    const node = host.querySelector(`[data-ev-error="${path}"]`);
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  async function addToBank(node) {
    const path = node.dataset.path;
    const list = PADMIN.evidence.listAt(current, path);
    const piece = list && list[Number(node.dataset.index)];
    if (!piece) return;
    const kind = /\.videos$/.test(path) ? 'video' : 'image';
    const title = piece.title || (kind === 'video' ? 'Video' : 'Imagen');
    try {
      status('Guardando en el banco…', 'busy');
      await PADMIN.api.addBankItem(PADMIN.media.toBankItem(piece, kind, title, serviceName(path)));
      bank = await PADMIN.api.listBankItems();
      render();
      status('Pieza añadida al banco.', '');
    } catch (error) {
      status(error.message, 'error', false);
    }
  }

  async function removeFromBank(node) {
    const id = node.dataset.id;
    if (!id) return;
    if (!root.confirm('¿Quitar esta pieza del banco? Dejará de mostrarse donde esté marcada.')) return;
    try {
      await PADMIN.api.removeBankItem(id);
      bank = await PADMIN.api.listBankItems();
      render();
      status('Pieza quitada del banco.', '');
    } catch (error) {
      status(error.message, 'error', false);
    }
  }

  async function uploadFile(input, file) {
    const path = input.dataset.evFile;
    try {
      status('Comprimiendo y subiendo…', 'busy');
      const media = await PADMIN.media.upload(file);
      signedMap[media.id] = media.signed || '';
      const title = String(file.name || '').replace(/\.[^.]+$/, '');
      current = PADMIN.evidence.appendPiece(current, path, { title, src: media.src, poster: '' });
      try {
        await PADMIN.api.addBankItem(
          PADMIN.media.toBankItem({ mediaId: media.id, src: media.src }, 'image', title, serviceName(path))
        );
        bank = await PADMIN.api.listBankItems();
      } catch (error) {
        // La pieza ya está en la cotización; el banco es opcional.
      }
      render();
      if (onChange) onChange(current);
      scheduleSave();
      status('Imagen subida.', '');
    } catch (error) {
      status(error.message, 'error', false);
      evError(path, error.message);
    }
  }

  async function onEvidence(op, node) {
    if (op === 'ev-bank-add') return addToBank(node);
    if (op === 'ev-bank-remove') return removeFromBank(node);
    if (op === 'ev-add-video' || op === 'ev-add-image') {
      const input = node.parentElement && node.parentElement.querySelector('[data-ev-input]');
      const value = input ? input.value.trim() : '';
      const error = op === 'ev-add-video' ? PADMIN.media.videoError(value) : PADMIN.media.imageError(value);
      if (error) return evError(node.dataset.path, error);
      evError(node.dataset.path, '');
    }
    const next = PADMIN.evidence.op(op, current, node);
    if (next === current) return;
    current = next;
    render();
    if (onChange) onChange(current);
    scheduleSave();
  }

  async function onOp(op, node) {
    if (/^ev-/.test(op)) return onEvidence(op, node);
    if (/^(pub|hist)-/.test(op)) {
      if (PADMIN.publish) await PADMIN.publish.op(op, node);
      return;
    }
    const index = Number(node.dataset.index);
    let next = current;
    if (op === 'block-add') next = M.addBlock(current);
    else if (op === 'block-up') next = M.moveBlock(current, index, index - 1);
    else if (op === 'block-down') next = M.moveBlock(current, index, index + 1);
    else if (op === 'block-dup') next = M.duplicateBlock(current, index);
    else if (op === 'block-del') next = M.removeBlock(current, index);
    else if (op === 'item-add') next = M.addItem(current, index);
    else if (op === 'item-del') next = M.removeItem(current, index, Number(node.dataset.item));
    else if (op === 'pay-add') next = M.addPayment(current);
    else if (op === 'pay-del') next = M.removePayment(current, index);
    else if (op === 'cond-add') next = M.addCondition(current);
    else if (op === 'cond-del') next = M.removeCondition(current, index);
    if (next === current) return;
    current = next;
    render();
    if (onChange) onChange(current);
    scheduleSave();
  }

  function mount(node, options) {
    root.clearTimeout(timer);
    timer = null;
    host = node;
    current = options.quote;
    onChange = options.onChange;
    save = options.save;
    bank = options.bank || [];
    signedMap = options.signedMap || {};
    if (PADMIN.publish) PADMIN.publish.setRow(options.row || null);
    savedAt = '';
    lastError = '';
    render();

    host.addEventListener('input', onInput);
    host.addEventListener('click', async (event) => {
      const op = event.target.closest('[data-op]');
      if (!op) return;
      event.preventDefault();
      if (op.dataset.op === 'retry-save') return flush();
      await onOp(op.dataset.op, op);
    });
    host.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-ev-file]');
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      await uploadFile(input, file);
      input.value = '';
    });
  }

  PADMIN.editor = {
    mount,
    refresh,
    flush,
    status,
    repaint: repaintPublish,
    currentQuote() {
      return current;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
