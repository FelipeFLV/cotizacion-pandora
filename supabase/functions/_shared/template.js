/* Generado por tools/build-template.mjs desde tools/cliente.template.html. No editar a mano. */
export const TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<meta name="theme-color" content="#F8F7F5">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="pandora-quote-id" content="{{QUOTE_ID}}">
<link rel="icon" href="{{BASE}}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{{BASE}}assets/fonts.css">
<link rel="stylesheet" href="{{BASE}}app/app.css">
<link rel="stylesheet" href="{{BASE}}app/print.css" media="print">
</head>
<body>
<a class="skip-link" href="#contenido">Ir al contenido</a>

<header class="topbar" id="topbar">
  <a class="brand" href="#resumen" aria-label="Pandora Marketing — inicio">
    <img src="{{BASE}}assets/logo-mark.png" alt="" width="30" height="30">
    <span class="brand-name">pandora</span>
  </a>

  <nav class="topnav" aria-label="Secciones">
    <a href="#resumen" data-nav>Resumen</a>
    <a href="#alcance" data-nav>Alcance</a>
    <a href="#evidencia" data-nav>Evidencia</a>
    <a href="#otros-trabajos" data-nav hidden>Otros trabajos</a>
    <a href="#inversion" data-nav>Inversión</a>
    <a href="#condiciones" data-nav>Condiciones</a>
  </nav>

  <div class="topbar-actions">
    <button class="icon-btn" data-action="fullscreen" title="Pantalla completa" aria-label="Pantalla completa">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
    </button>
    <button class="btn primary" data-action="print">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v3h16v-3"/></svg>
      Exportar PDF
    </button>
  </div>
</header>

<main id="contenido">

  <section class="hero" id="resumen" aria-labelledby="client-name">
    <div class="hero-motif" aria-hidden="true">
      <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M200 40 340 120v160L200 360 60 280V120z"/>
        <path d="M200 40v320M60 120l280 160M340 120 60 280"/>
      </svg>
    </div>

    <div class="hero-inner">
      <div class="hero-copy">
        <img class="print-brand print-only" src="{{BASE}}assets/logo-pandora.png" alt="Pandora Marketing con propósito">
        <p class="doc-meta">
          <span>Cotización <b data-field="meta.quoteNo"></b></span>
          <span class="sep" aria-hidden="true"></span>
          <span class="date-view"><time data-date datetime="{{DATE_ISO}}">{{DATE_LABEL}}</time></span>
        </p>

        <p class="for">Propuesta preparada para</p>
        <h1 class="client" id="client-name" data-field="meta.client"></h1>
        <p class="lede" data-field="meta.lede"></p>

        <dl class="hero-facts">
          <div>
            <dt>Servicio</dt>
            <dd data-summary="services"></dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd><span data-field="meta.duration"></span></dd>
          </div>
          <div>
            <dt>Vigencia</dt>
            <dd><span data-field="meta.validity"></span></dd>
          </div>
        </dl>
      </div>

      <aside class="docket" aria-label="Resumen de inversión">
        <div class="docket-head">
          <span class="docket-label">Inversión total</span>
          <p class="docket-total"><span data-total="grand"></span></p>
          <p class="docket-note" data-summary="taxNote"></p>
        </div>
        <div class="docket-perf" aria-hidden="true"></div>
        <div class="docket-body">
          <div class="docket-row">
            <span>Subtotal</span>
            <span data-total="subtotal"></span>
          </div>
          <div class="docket-row" data-igv-row>
            <span>I.G.V. <span data-summary="igvPct"></span></span>
            <span data-total="igv"></span>
          </div>
          <div class="docket-split">
            <div class="split-bar" data-split-bar aria-hidden="true"></div>
            <p data-summary="split"></p>
          </div>
        </div>
        <div class="docket-foot">
          <span class="stamp">Pandora Marketing S.A.C.</span>
          <span class="stamp muted">RUC 20559862585</span>
        </div>
      </aside>
    </div>

    <dl class="cover-foot print-only">
      <div>
        <dt>Vigencia</dt>
        <dd><span data-field="meta.validity"></span> desde la emisión</dd>
      </div>
      <div>
        <dt>Contacto</dt>
        <dd>+51 934 363 689</dd>
      </div>
      <div>
        <dt>Correo</dt>
        <dd>info@pandoramarketing.net</dd>
      </div>
    </dl>

    <a class="scroll-hint" href="#alcance">
      <span>Ver alcance</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v15m0 0 5-5m-5 5-5-5"/></svg>
    </a>
  </section>

  <div id="chapters"></div>

  <section class="section section-invest" id="inversion" aria-labelledby="h-inversion">
    <header class="section-head">
      <span class="num" data-num></span>
      <h2 id="h-inversion">Inversión</h2>
      <span class="head-rule" aria-hidden="true"></span>
      <span class="head-note" data-summary="taxNoteShort"></span>
    </header>

    <div class="invest-grid">
      <div class="price-sheet">
        <div id="price-groups"></div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span data-total="subtotal"></span>
          </div>
          <div class="total-row" data-igv-row>
            <span>I.G.V. <span data-summary="igvPct"></span></span>
            <span data-total="igv"></span>
          </div>
          <div class="total-row grand">
            <span>Total</span>
            <span data-total="grand"></span>
          </div>
        </div>
      </div>

      <aside class="terms">
        <div class="terms-block">
          <h3>Forma de pago</h3>
          <div class="paybar" data-split-bar></div>
          <ul class="paylist" id="paylist"></ul>
        </div>

        <div class="terms-block">
          <h3>Datos para el depósito</h3>
          <dl class="bank" id="bank"></dl>
          <p class="bank-note">Envía el comprobante a <a href="mailto:info@pandoramarketing.net">info@pandoramarketing.net</a>.</p>
        </div>
      </aside>
    </div>
  </section>

  <section class="section section-terms" id="condiciones" aria-labelledby="h-condiciones">
    <header class="section-head">
      <span class="num" data-num></span>
      <h2 id="h-condiciones">Condiciones</h2>
      <span class="head-rule" aria-hidden="true"></span>
    </header>

    <div class="terms-grid">
      <div class="cond-list" id="conditions"></div>
      <div class="closing">
        <p class="closing-note"><span data-field="meta.closing"></span></p>
        <p class="signature">
          <span class="sig-name">Equipo Pandora</span>
          <span class="sig-role">Marketing con propósito</span>
        </p>
      </div>
    </div>
  </section>

  <footer class="print-foot print-only">
    <img src="{{BASE}}assets/logo-pandora.png" alt="Pandora Marketing con propósito">
    <div class="print-foot-lines">
      <p>Pandora Marketing S.A.C. · RUC 20559862585</p>
      <p>+51 934 363 689 · info@pandoramarketing.net · pandoramarketing.net</p>
      <p data-generated-label></p>
    </div>
  </footer>
</main>

<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-brand">
      <img src="{{BASE}}assets/logo-pandora.png" alt="Pandora Marketing con propósito" width="188" height="24">
    </div>
    <div class="foot-meta">
      <a href="https://wa.me/51934363689">+51 934 363 689</a>
      <a href="mailto:info@pandoramarketing.net">info@pandoramarketing.net</a>
      <a href="https://pandoramarketing.net">pandoramarketing.net</a>
    </div>
  </div>
</footer>

<div class="lightbox" id="lightbox" hidden>
  <button class="lb-close" data-action="close-lightbox" aria-label="Cerrar">✕</button>
  <figure class="lb-fig">
    <img id="lbImg" alt="">
    <figcaption id="lbCap"></figcaption>
  </figure>
</div>

<script>window.P = { assetBase: '{{BASE}}' };</script>
<script>window.__PANDORA__ = {{DATA}};</script>
<script src="{{BASE}}app/core.js"></script>
<script src="{{BASE}}app/render.js"></script>
<script src="{{BASE}}app/client.js"></script>
</body>
</html>
`;
