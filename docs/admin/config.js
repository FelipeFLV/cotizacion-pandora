/* Configuración pública del panel. Solo datos que pueden viajar al navegador:
   la URL del proyecto y la anon key (protegida por RLS). Nunca la clave secreta. */
(function (root) {
  'use strict';

  root.PANDORA_ADMIN_CONFIG = {
    SUPABASE_URL: 'https://zvusvaotqtchaglwyifl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2dXN2YW90cXRjaGFnbHd5aWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNDE4ODksImV4cCI6MjEwODgxNzg4OX0.XY5evibmQv7cTO6XmJ-N6qs_WqQDFd8ieKt6LyobDj0',
    ALLOWED_EMAIL: 'felipeflores1986@gmail.com'
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
      if (!EMAIL_RE.test(String(cfg.ALLOWED_EMAIL || ''))) {
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
    allowedEmail() {
      return String(root.PANDORA_ADMIN_CONFIG.ALLOWED_EMAIL || '').trim().toLowerCase();
    },
    isAllowedEmail(email) {
      return String(email || '').trim().toLowerCase() === config.allowedEmail();
    }
  };

  root.PADMIN = Object.assign(root.PADMIN || {}, { config });
})(typeof window !== 'undefined' ? window : globalThis);
