/* Catálogo de servicios y cotización inicial.
   Los datos viven en `docs/app/catalog-data.js` para compartirlos con el panel
   privado y las pruebas. La evidencia de cada servicio se edita en el panel. */
(function (root, factory) {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('../docs/app/core.js') : root.P;
  const data = isNode
    ? require('../docs/app/catalog-data.js')
    : { catalog: (core && core.catalog) || {}, blockFromService: core && core.blockFromService };
  const api = factory(core || {}, data || {});
  if (isNode) {
    Object.assign(core, api);
    module.exports = core;
  } else {
    root.P = Object.assign(root.P || {}, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, data) {
  'use strict';

  const uid = core.uid || ((prefix) => prefix + Math.random().toString(36).slice(2, 8));

  const catalog = data.catalog || {};
  const blockFromService = data.blockFromService || (() => null);

  const LEGACY_HS_SLUG = 'h-s-inmobiliaria-7k2m';

  function defaultQuote() {
    return {
      version: 2,
      id: '',
      evidence: { mode: 'service', generalIds: { videos: [], images: [] } },
      meta: {
        quoteNo: 'OCT26-23',
        date: '2026-10-23',
        client: 'H&S Inmobiliaria',
        lede: 'Inversión con criterio: cada sol rinde y se mide.',
        duration: '3 meses',
        validity: '30 días',
        taxEnabled: true,
        taxRate: 18,
        payments: [
          { label: 'Al dar inicio al servicio', pct: 60 },
          { label: 'Al mes siguiente', pct: 40 }
        ],
        closing: 'Estamos listos para empezar cuando tú lo estés. Cualquier ajuste al alcance se conversa antes de la firma.',
        slug: LEGACY_HS_SLUG,
        generatedAt: '',
        publishedUrl: '',
        publishedAt: '',
        retiredAt: '',
        retireRequestedAt: '',
        conditions: [
          'La proforma tiene una vigencia de 30 días desde la fecha de emisión.',
          'Los precios están expresados en soles peruanos y no incluyen I.G.V. salvo indicación contraria.',
          'La inversión publicitaria se factura por adelantado y se ejecuta según el plan aprobado.',
          'Cualquier cambio de alcance se cotiza por separado antes de su ejecución.'
        ]
      },
      bank: {
        holder: 'Pandora Marketing S.A.C.',
        account: '5702449750023',
        cci: '002-57000244975002301',
        detractions: '00 771 021492',
        bankName: 'BCP · Cuenta corriente'
      },
      blocks: [blockFromService('metaads')]
    };
  }

  function seedEvidenceBank() {
    const bank = { videos: [], images: [] };
    Object.values(catalog).forEach((service) => {
      const video = (service.videos || [])[0];
      if (video) {
        bank.videos.push({
          id: uid('e'),
          title: `${service.name} — ${video.title}`,
          src: video.src,
          poster: video.poster || '',
          service: service.name
        });
      }
      const image = (service.images || [])[0];
      if (image) {
        bank.images.push({
          id: uid('e'),
          title: `${service.name} — ${image.title}`,
          src: image.src,
          service: service.name
        });
      }
    });
    return bank;
  }

  function newQuote(serviceId) {
    const quote = defaultQuote();
    quote.meta.client = 'Cliente sin nombre';
    quote.meta.quoteNo = '';
    quote.meta.lede = 'Propuesta de marketing con propósito.';
    quote.meta.date = core.todayISO ? core.todayISO() : new Date().toISOString().slice(0, 10);
    quote.meta.slug = '';
    quote.meta.publishedUrl = '';
    quote.meta.publishedAt = '';
    quote.meta.retiredAt = '';
    quote.evidence = { mode: 'service', generalIds: { videos: [], images: [] } };
    const block = blockFromService(serviceId) || blockFromService('metaads');
    quote.blocks = [block];
    return quote;
  }

  return {
    catalog,
    blockFromService,
    LEGACY_HS_SLUG,
    defaultQuote,
    newQuote,
    seedEvidenceBank,
    clone: (value) => JSON.parse(JSON.stringify(value))
  };
});
