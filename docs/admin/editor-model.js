/* Modelo puro del editor: copias inmutables, bloques, líneas y pagos. */
(function (root) {
  'use strict';

  const P = root.P;
  const PADMIN = (root.PADMIN = root.PADMIN || {});

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function nextUid(quote) {
    const used = new Set(((quote && quote.blocks) || []).map((block) => block.uid));
    let n = ((quote && quote.blocks) || []).length + 1;
    let uid = `b${n}`;
    while (used.has(uid)) {
      n += 1;
      uid = `b${n}`;
    }
    return uid;
  }

  function emptyBlock(uid) {
    return {
      uid,
      serviceId: '',
      serviceName: '',
      title: '',
      tagline: '',
      duration: '',
      deliverables: [],
      considerations: [],
      process: [],
      items: [],
      videos: [],
      images: []
    };
  }

  function addBlock(quote) {
    const out = clone(quote);
    out.blocks = out.blocks || [];
    out.blocks.push(emptyBlock(nextUid(out)));
    return out;
  }

  function duplicateBlock(quote, index) {
    const out = clone(quote);
    const source = (out.blocks || [])[index];
    if (!source) return out;
    const copy = clone(source);
    copy.uid = nextUid(out);
    out.blocks.splice(index + 1, 0, copy);
    return out;
  }

  function removeBlock(quote, index) {
    const out = clone(quote);
    if (!out.blocks || out.blocks.length <= 1) return out;
    out.blocks.splice(index, 1);
    return out;
  }

  function moveBlock(quote, from, to) {
    const out = clone(quote);
    const list = out.blocks || [];
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return out;
    const [block] = list.splice(from, 1);
    list.splice(to, 0, block);
    return out;
  }

  function addItem(quote, index) {
    const out = clone(quote);
    const block = (out.blocks || [])[index];
    if (!block) return out;
    block.items = block.items || [];
    block.items.push({ label: 'Nuevo concepto', amount: 0 });
    return out;
  }

  function addStep(quote, index) {
    const out = clone(quote);
    const block = (out.blocks || [])[index];
    if (!block) return out;
    block.process = block.process || [];
    block.process.push({ title: 'Nuevo paso', detail: '' });
    return out;
  }

  function removeStep(quote, index, stepIndex) {
    const out = clone(quote);
    const block = (out.blocks || [])[index];
    if (!block || !block.process || !block.process.length) return out;
    block.process.splice(stepIndex, 1);
    return out;
  }

  function removeItem(quote, index, itemIndex) {
    const out = clone(quote);
    const block = (out.blocks || [])[index];
    if (!block || !block.items || block.items.length <= 1) return out;
    block.items.splice(itemIndex, 1);
    return out;
  }

  function addPayment(quote) {
    const out = clone(quote);
    out.meta = out.meta || {};
    out.meta.payments = out.meta.payments || [];
    out.meta.payments.push({ label: 'Nuevo pago', pct: 0 });
    return out;
  }

  function removePayment(quote, index) {
    const out = clone(quote);
    const list = (out.meta && out.meta.payments) || [];
    if (list.length <= 1) return out;
    list.splice(index, 1);
    return out;
  }

  function addCondition(quote) {
    const out = clone(quote);
    out.meta = out.meta || {};
    out.meta.conditions = out.meta.conditions || [];
    out.meta.conditions.push('');
    return out;
  }

  function removeCondition(quote, index) {
    const out = clone(quote);
    const list = (out.meta && out.meta.conditions) || [];
    list.splice(index, 1);
    return out;
  }

  function paymentTotal(quote) {
    return ((quote && quote.meta && quote.meta.payments) || []).reduce(
      (sum, payment) => sum + (Number(payment.pct) || 0),
      0
    );
  }

  function paymentValid(quote) {
    return Math.abs(paymentTotal(quote) - 100) < 0.01;
  }

  function totals(quote) {
    return P && typeof P.totals === 'function'
      ? P.totals(quote)
      : { subtotal: 0, igv: 0, grand: 0, rate: 0 };
  }

  PADMIN.editorModel = {
    setPath,
    addBlock,
    duplicateBlock,
    removeBlock,
    moveBlock,
    addItem,
    removeItem,
    addStep,
    removeStep,
    addPayment,
    removePayment,
    addCondition,
    removeCondition,
    paymentTotal,
    paymentValid,
    totals,
    nextUid
  };
})(typeof window !== 'undefined' ? window : globalThis);
