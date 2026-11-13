/* Configuración pública del panel. Solo datos que pueden viajar al navegador:
   la URL del proyecto y la anon key (protegida por RLS). Nunca la clave secreta. */
(function (root) {
  'use strict';

  root.PANDORA_ADMIN_CONFIG = {
    SUPABASE_URL: 'https://zvusvaotqtchaglwyifl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2dXN2YW90cXRjaGFnbHd5aWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNDE4ODksImV4cCI6MjEwODgxNzg4OX0.XY5evibmQv7cTO6XmJ-N6qs_WqQDFd8ieKt6LyobDj0',
    ALLOWED_EMAIL: 'felipeflores1986@gmail.com',
    ALLOWED_EMAILS: ['felipeflores1986@gmail.com', 'info@pandoramarketing.net']
  };

  const URL_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
  const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

  const config = {
    validate(value) {
      const cfg = value || {};
      const errors = [];
      if (!URL_RE.test(String(cfg.SUPABASE_URL || ''))) {
        errors.push('SUPABASE_URL debe ser https://<ref>.supabase.co');
      }
      if (!JWT_RE.test(String(cfg.SUPABASE_ANON_KEY || ''))) {
        errors.push('SUPABASE_ANON_KEY debe ser la anon key en formato JWT');
      }
      const rawEmail = String(cfg.ALLOWED_EMAIL || '');
      const emails = Array.isArray(cfg.ALLOWED_EMAILS) && cfg.ALLOWED_EMAILS.length
        ? cfg.ALLOWED_EMAILS
        : rawEmail.split(',').map((e) => e.trim()).filter(Boolean);

      if (!emails.length || !emails.every((e) => EMAIL_RE.test(e))) {
        errors.push('ALLOWED_EMAIL debe ser un correo válido');
      }
      return errors;
    },
    url() {
      return String(root.PANDORA_ADMIN_CONFIG.SUPABASE_URL || '').replace(/\/+$/, '');
    },
    anonKey() {
      return String(root.PANDORA_ADMIN_CONFIG.SUPABASE_ANON_KEY || '');
    },
    allowedEmails() {
      const cfg = root.PANDORA_ADMIN_CONFIG || {};
      if (Array.isArray(cfg.ALLOWED_EMAILS) && cfg.ALLOWED_EMAILS.length) {
        return cfg.ALLOWED_EMAILS.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
      }
      return String(cfg.ALLOWED_EMAIL || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    },
    allowedEmail() {
      return config.allowedEmails()[0] || '';
    },
    isAllowedEmail(email) {
      const target = String(email || '').trim().toLowerCase();
      return Boolean(target) && config.allowedEmails().includes(target);
    }
  };

  root.PADMIN = Object.assign(root.PADMIN || {}, { config });
})(typeof window !== 'undefined' ? window : globalThis);
