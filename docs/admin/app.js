/* Arranque del panel: alterna entre el acceso y la sesión iniciada. */
(function (root) {
  'use strict';

  const PADMIN = root.PADMIN;
  const doc = root.document;
  const els = {};

  function q(id) {
    return doc.getElementById(id);
  }

  function setStatus(message, kind) {
    els.status.textContent = message || '';
    els.status.dataset.kind = kind || '';
    els.status.hidden = !message;
  }

  function showLogin() {
    els.login.hidden = false;
    els.panel.hidden = true;
    els.signout.hidden = true;
    els.form.hidden = false;
    els.email.value = PADMIN.config.allowedEmail();
    els.email.focus();
  }

  function showPanel(user) {
    els.login.hidden = true;
    els.panel.hidden = false;
    els.signout.hidden = false;
    els.who.textContent = user.email;
    els.form.reset();
    setStatus('', '');
  }

  async function boot() {
    els.login = q('login');
    els.panel = q('panel');
    els.form = q('login-form');
    els.email = q('email');
    els.status = q('login-status');
    els.who = q('who');
    els.signout = q('signout');

    const errors = PADMIN.config.validate(root.PANDORA_ADMIN_CONFIG);
    if (errors.length) {
      els.form.hidden = true;
      setStatus(errors.join(' · '), 'error');
      return;
    }

    try {
      const client = PADMIN.auth.init(root.PANDORA_ADMIN_CONFIG);
      PADMIN.api.init(client);
    } catch (error) {
      els.form.hidden = true;
      setStatus(error.message, 'error');
      return;
    }

    PADMIN.auth.onChange(async (event, session) => {
      if (event === 'SIGNED_OUT') return showLogin();
      if (session && session.user) {
        if (!PADMIN.auth.isAllowed(session.user)) {
          await PADMIN.auth.signOut();
          setStatus('Ese correo no está autorizado.', 'error');
          return showLogin();
        }
        showPanel(session.user);
      }
    });

    const current = await PADMIN.auth.session();
    if (current && current.user && PADMIN.auth.isAllowed(current.user)) {
      showPanel(current.user);
      return;
    }
    if (current && current.user) {
      await PADMIN.auth.signOut();
      setStatus('Ese correo no está autorizado.', 'error');
    }
    showLogin();
  }

  async function submit(event) {
    event.preventDefault();
    const email = els.email.value.trim();
    const button = els.form.querySelector('button[type=submit]');
    button.disabled = true;
    setStatus('Enviando enlace…', 'busy');
    try {
      await PADMIN.auth.signIn(email);
      setStatus(`Revisa ${email}. El enlace sirve una sola vez y vence en una hora.`, 'ok');
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      setStatus(/authorized|not allowed|signups/i.test(message)
        ? 'Ese correo no está autorizado para entrar.'
        : `No se pudo enviar el enlace: ${message}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function signOut() {
    PADMIN.auth.signOut();
  }

  doc.addEventListener('DOMContentLoaded', () => {
    boot().catch((error) => {
      if (els.status) setStatus(`Error al iniciar: ${error.message}`, 'error');
    });
    doc.addEventListener('submit', (event) => {
      if (event.target === els.form) submit(event);
    });
    doc.addEventListener('click', (event) => {
      if (event.target.closest('#signout')) signOut();
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
