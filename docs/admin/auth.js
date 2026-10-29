/* Sesión del panel: un único correo autorizado, enlace mágico y sesión persistente. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});
  let client = null;

  function redirectTo() {
    return root.location.origin + root.location.pathname;
  }

  function init(config) {
    const errors = PADMIN.config.validate(config);
    if (errors.length) throw new Error(errors.join(' · '));
    if (!root.supabase || typeof root.supabase.createClient !== 'function') {
      throw new Error('No se cargó vendor/supabase.js');
    }
    client = root.supabase.createClient(PADMIN.config.url(), PADMIN.config.anonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
    return client;
  }

  async function signIn(email) {
    if (!client) throw new Error('El cliente de Supabase no está inicializado.');
    const value = String(email || '').trim();
    if (!PADMIN.config.isAllowedEmail(value)) throw new Error('Ese correo no está autorizado.');
    const result = await client.auth.signInWithOtp({
      email: value,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo() }
    });
    if (result.error) throw result.error;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  async function session() {
    if (!client) return null;
    const result = await client.auth.getSession();
    return result.data ? result.data.session : null;
  }

  function onChange(callback) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, next) => callback(event, next));
    return () => data.subscription.unsubscribe();
  }

  function isAllowed(user) {
    const email = String((user && user.email) || '').trim().toLowerCase();
    return Boolean(email) && email === PADMIN.config.allowedEmail();
  }

  PADMIN.auth = { init, signIn, signOut, session, onChange, isAllowed, redirectTo };
})(typeof window !== 'undefined' ? window : globalThis);
