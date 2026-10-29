/* Vista previa del panel: recibe la cotización por postMessage y la renderiza
   con el mismo renderizador y los mismos estilos que la página publicada. */
(function (root) {
  'use strict';

  root.P.assetBase = '../';

  const ORIGIN = root.location.origin;

  function accept(data) {
    if (!data || data.type !== 'pandora-preview' || !data.quote) return false;
    root.P.client.init({
      quote: data.quote,
      general: data.general,
      meta: data.meta || {}
    });
    const name = (data.quote.meta && data.quote.meta.client) || 'Pandora';
    root.document.title = `Vista previa · ${name}`;
    return true;
  }

  root.addEventListener('message', (event) => {
    if (event.origin !== ORIGIN) return;
    if (event.data && event.data.type === 'pandora-preview-print') {
      root.print();
      return;
    }
    accept(event.data);
  });

  if (root.__PANDORA_PREVIEW__) accept(root.__PANDORA_PREVIEW__);

  root.parent.postMessage({ type: 'pandora-preview-ready' }, ORIGIN);
})(typeof window !== 'undefined' ? window : globalThis);
