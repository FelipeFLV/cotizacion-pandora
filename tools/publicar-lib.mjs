import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../docs/app/core.js');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fill(template, token, value) {
  return template.split(`{{${token}}}`).join(value);
}

export function clientData(quote, general, generatedAt) {
  return JSON.stringify({
    quote,
    general: general || { videos: [], images: [] },
    meta: { generatedAt: generatedAt || '' }
  })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildClientHtml({ template, pkg, base }) {
  const quote = pkg.quote;
  const date = quote.meta.date || '';
  let html = template;
  html = fill(html, 'TITLE', escapeHtml(`Propuesta · ${quote.meta.client || 'Pandora Marketing'}`));
  html = fill(html, 'DESCRIPTION', escapeHtml('Propuesta de Pandora Marketing: alcance, evidencia e inversión.'));
  html = fill(html, 'QUOTE_ID', escapeHtml(quote.id || pkg.slug));
  html = fill(html, 'GENERATED_AT', escapeHtml(pkg.generatedAt || ''));
  html = fill(html, 'DATE_ISO', escapeHtml(date));
  html = fill(html, 'DATE_LABEL', escapeHtml(P.dateLabel(date)));
  html = fill(html, 'BASE', base);
  html = fill(html, 'DATA', clientData(quote, pkg.general, pkg.generatedAt));
  return html;
}
