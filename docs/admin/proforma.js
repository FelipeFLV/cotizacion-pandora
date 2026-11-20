/* Formato de proforma para el equipo. Recibe los datos de la cotización por postMessage. */
(function (root) {
  'use strict';

  const ORIGIN = root.location.origin;
  const doc = root.document;

  function addListSection(host, title, entries) {
    const items = (Array.isArray(entries) ? entries : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (!items.length) return;

    const section = doc.createElement('section');
    section.className = 'service-section';
    if (title === 'Incluye también') section.classList.add('service-section--extra');
    const heading = doc.createElement('h3');
    heading.textContent = `${title}:`;
    const list = doc.createElement('ul');
    list.className = 'proforma-list';
    items.forEach((item) => {
      const li = doc.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    section.append(heading, list);
    host.appendChild(section);
  }

  function formatAmount(value, currency) {
    const amount = Number(value) || 0;
    const decimals = Number.isInteger(amount) ? 0 : 2;
    return `${root.P.currencySymbol(currency)}${new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: 2
    }).format(amount)}`;
  }

  function serviceSubtotal(block) {
    return (Array.isArray(block.items) ? block.items : []).reduce(
      (sum, item) => sum + (Number(item && item.amount) || 0), 0
    );
  }

  function render(data) {
    const quote = data.quote || {};
    const meta = quote.meta || {};
    const blocks = Array.isArray(quote.blocks) ? quote.blocks : [];

    doc.getElementById('client-name').textContent = meta.client || '';
    const logo = doc.getElementById('client-logo');
    if (!meta.client && meta.clientLogo) {
      logo.src = meta.clientLogo;
      logo.alt = 'Logo del cliente';
      logo.hidden = false;
    } else {
      logo.removeAttribute('src');
      logo.alt = '';
      logo.hidden = true;
    }
    doc.getElementById('quote-date').textContent = root.P.shortDate(meta.date || '');

    const services = doc.getElementById('service-list');
    services.replaceChildren();
    blocks.forEach((block) => {
      const service = doc.createElement('section');
      service.className = 'service';
      const title = doc.createElement('h2');
      title.className = 'service-title';
      title.textContent = block.title || block.serviceName || 'Servicio';
      service.appendChild(title);
      addListSection(service, 'Detalle', block.deliverables);
      addListSection(service, 'Incluye también', block.includesAlso);
      addListSection(service, 'Consideraciones', block.considerations);
      services.appendChild(service);
    });

    const subtotal = blocks.reduce((sum, block) => sum + serviceSubtotal(block), 0);
    const taxNote = meta.taxEnabled ? 'más I.G.V.' : 'I.G.V. no aplicado';
    const investmentKind = meta.investmentType === 'monthly' ? 'Inversión Mensual' : 'Inversión Total';
    doc.getElementById('investment-label').textContent = blocks.length > 1
      ? `${investmentKind} por los servicios:`
      : `${investmentKind} por el servicio:`;
    doc.getElementById('investment-total').textContent = `${formatAmount(subtotal, meta.currency)} ${taxNote}`;

    const bank = quote.bank || {};
    const lines = [];
    if (bank.account) {
      const bankName = String(bank.bankName || '').split('·')[0].trim();
      lines.push(`Cta Cte${bankName ? ` ${bankName}` : ''}: ${bank.account}`);
    }
    if (bank.cci) lines.push(`CCI: ${bank.cci}`);
    if (bank.detractions) lines.push(`Detracciones: ${bank.detractions}`);
    const bankHost = doc.getElementById('bank-lines');
    bankHost.replaceChildren();
    lines.forEach((line) => {
      const p = doc.createElement('p');
      p.className = 'bank-line';
      p.textContent = line;
      bankHost.appendChild(p);
    });
    doc.querySelector('.bank-details').hidden = lines.length === 0;

    const validity = String(meta.validity || '30 días').trim();
    doc.getElementById('validity').textContent = `Proforma válida por ${validity}.`;
    const filename = [meta.quoteNo, meta.client].filter(Boolean).join(' - ') || 'Pandora';
    root.document.title = `Proforma ${filename}`;
  }

  root.addEventListener('message', (event) => {
    if (event.origin !== ORIGIN) return;
    const data = event.data;
    if (!data || data.type !== 'pandora-preview' || !data.quote) return;
    render(data);
  });

  root.parent.postMessage({ type: 'pandora-preview-ready' }, ORIGIN);
})(typeof window !== 'undefined' ? window : globalThis);
