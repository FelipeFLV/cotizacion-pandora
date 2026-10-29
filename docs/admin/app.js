/* Arranque del panel: sesión, biblioteca y acciones de la barra lateral. */
(function (root) {
  'use strict';

  const PADMIN = root.PADMIN;
  const doc = root.document;
  const STORE_KEY = 'pandora.admin.active';

  const state = {
    quotes: [],
    activeId: '',
    filter: 'all',
    query: '',
    user: null,
    editing: null
  };

  const $ = (id) => doc.getElementById(id);

  let toastTimer = null;
  function toast(message, kind) {
    const box = $('toast');
    if (!box) return;
    box.textContent = message;
    box.dataset.kind = kind || 'ok';
    box.hidden = false;
    root.clearTimeout(toastTimer);
    toastTimer = root.setTimeout(() => { box.hidden = true; }, 5200);
  }

  function setLoginStatus(message, kind) {
    const box = $('login-status');
    box.textContent = message || '';
    box.dataset.kind = kind || '';
    box.hidden = !message;
  }

  function showLogin() {
    state.user = null;
    $('login').hidden = false;
    $('panel').hidden = true;
    $('signout').hidden = true;
    $('import-open').hidden = true;
    $('who').textContent = '';
    $('login-form').hidden = false;
    $('email').value = PADMIN.config.allowedEmail();
    $('email').focus();
  }

  function showPanel(user) {
    state.user = user;
    $('login').hidden = true;
    $('panel').hidden = false;
    $('signout').hidden = false;
    $('import-open').hidden = false;
    $('who').textContent = user.email;
    $('login-form').reset();
    setLoginStatus('', '');
    load().catch((error) => toast(`No se pudo cargar la biblioteca: ${error.message}`, 'error'));
  }

  function renderList() {
    $('filters').innerHTML = PADMIN.library.filters(state.filter);
    $('quote-list').innerHTML = PADMIN.library.render({
      quotes: state.quotes,
      activeId: state.activeId,
      filter: state.filter,
      query: state.query
    });
    const visible = state.quotes.filter((row) => {
      const kind = PADMIN.library.state(row);
      if (state.filter === 'draft' && kind !== 'draft' && kind !== 'template') return false;
      if (state.filter === 'published' && kind !== 'published') return false;
      if (state.filter === 'retired' && kind !== 'retired') return false;
      return true;
    });
    $('list-count').textContent = `${visible.length} de ${state.quotes.length}`;
  }

  function active() {
    return state.quotes.find((row) => row.id === state.activeId) || null;
  }

  function headerHtml(row) {
    const meta = (row.data && row.data.meta) || {};
    const kind = PADMIN.library.state(row);
    const url = PADMIN.library.urlOf(row);
    const date = meta.date && root.P && root.P.dateLabel ? root.P.dateLabel(meta.date) : meta.date;
    return `<div class="editor-head">
      <p class="admin-kicker">${kind === 'template' ? 'Plantilla' : 'Cotización'}</p>
      <h2 data-editor-client>${PADMIN.library.esc(meta.client || 'Cliente sin nombre')}</h2>
      <p class="editor-sub">${PADMIN.library.esc([meta.quoteNo, date].filter(Boolean).join(' · '))}
        <span class="pill pill-${kind}">${PADMIN.library.LABELS[kind]}</span></p>
      ${url ? `<p class="editor-url"><a href="${PADMIN.library.esc(url)}" target="_blank" rel="noopener">${PADMIN.library.esc(url)}</a></p>` : ''}
    </div>`;
  }

  function paintHeader(row) {
    const head = $('editor').querySelector('.editor-head');
    if (!head || !row) return;
    head.outerHTML = headerHtml(row);
  }

  async function saveActive(quote) {
    const id = state.activeId;
    const row = await PADMIN.api.saveQuote(id, quote);
    const entry = state.quotes.find((item) => item.id === id);
    if (entry) {
      entry.data = row.data || quote;
      entry.status = row.status;
      entry.slug = row.slug;
    }
    if (state.editing && state.editing.id === id) state.editing.quote = quote;
    renderList();
    paintHeader(entry || row);
  }

  function mountEditor(row) {
    const box = $('editor');
    const quote = PADMIN.model.rowToQuote(row);
    state.editing = { id: row.id, quote };
    box.innerHTML = `${headerHtml(row)}<div class="editor-body" id="editor-body"></div>`;
    PADMIN.editor.mount($('editor-body'), {
      quote,
      onChange(next) {
        state.editing.quote = next;
        const entry = state.quotes.find((item) => item.id === row.id);
        if (entry) entry.data = next;
        paintHeader(entry || row);
      },
      save: saveActive
    });
  }

  function renderEditor() {
    const row = active();
    if (!row) {
      state.editing = null;
      $('editor').innerHTML = `<div class="editor-empty">
        <p class="admin-kicker">Sin selección</p>
        <h2>Elige una cotización</h2>
        <p class="admin-lead">Abre una de la izquierda o importa tu biblioteca para empezar.</p>
      </div>`;
      return;
    }
    if (state.editing && state.editing.id === row.id) {
      paintHeader(row);
      return;
    }
    mountEditor(row);
  }

  async function load() {
    state.quotes = await PADMIN.api.listQuotes();
    const remembered = root.localStorage.getItem(STORE_KEY) || '';
    const exists = state.quotes.some((row) => row.id === state.activeId);
    if (!exists) {
      state.editing = null;
      state.activeId = state.quotes.some((row) => row.id === remembered) ? remembered : '';
    }
    renderList();
    renderEditor();
  }

  async function selectQuote(id) {
    if (state.activeId && state.activeId !== id) await PADMIN.editor.flush();
    state.activeId = id;
    state.editing = null;
    root.localStorage.setItem(STORE_KEY, id);
    renderList();
    renderEditor();
  }

  async function act(action, id) {
    const row = state.quotes.find((item) => item.id === id);
    if (action === 'open') return selectQuote(id);
    if (action === 'publish' || action === 'history') {
      return toast('Esta acción se conecta en la siguiente etapa.');
    }
    if (!row) return;
    if (state.activeId === id && state.editing) await PADMIN.editor.flush();

    if (action === 'duplicate') {
      const copy = await PADMIN.api.duplicateQuote(id);
      await load();
      return selectQuote(copy.id);
    }
    if (action === 'new-client') {
      const created = await PADMIN.api.newClientFrom(id);
      await load();
      return selectQuote(created.id);
    }
    if (action === 'set-template') {
      const name = (row.data && row.data.meta && row.data.meta.client) || 'esta cotización';
      if (!root.confirm(`¿Usar ${name} como plantilla de nuevos clientes?`)) return;
      await PADMIN.api.setTemplate(id);
      await load();
      return toast('Plantilla actualizada.');
    }
    if (action === 'archive') {
      const name = (row.data && row.data.meta && row.data.meta.client) || 'esta cotización';
      if (!root.confirm(`¿Archivar ${name}? Podrás recuperarla después.`)) return;
      await PADMIN.api.archiveQuote(id);
      if (state.activeId === id) state.activeId = '';
      await load();
      return toast('Cotización archivada.');
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new root.FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsText(file);
    });
  }

  async function importBackup(file) {
    try {
      const json = JSON.parse(await readFile(file));
      const count = Array.isArray(json.quotes) ? json.quotes.length : 0;
      if (!count) throw new Error('El respaldo no trae cotizaciones.');
      if (!root.confirm(`Se añadirán ${count} ${count === 1 ? 'cotización' : 'cotizaciones'} sin borrar las existentes. ¿Continuar?`)) return;
      const result = await PADMIN.api.importBackup(json);
      await load();
      toast(`Importadas ${result.quotes.length} cotizaciones y ${result.bank} piezas de evidencia.`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function boot() {
    const errors = PADMIN.config.validate(root.PANDORA_ADMIN_CONFIG);
    if (errors.length) {
      $('login-form').hidden = true;
      setLoginStatus(errors.join(' · '), 'error');
      return;
    }
    try {
      const client = PADMIN.auth.init(root.PANDORA_ADMIN_CONFIG);
      PADMIN.api.init(client);
    } catch (error) {
      $('login-form').hidden = true;
      setLoginStatus(error.message, 'error');
      return;
    }

    PADMIN.auth.onChange(async (event, session) => {
      if (event === 'SIGNED_OUT') return showLogin();
      if (session && session.user) {
        if (!PADMIN.auth.isAllowed(session.user)) {
          await PADMIN.auth.signOut();
          setLoginStatus('Ese correo no está autorizado.', 'error');
          return showLogin();
        }
        if (!state.user) showPanel(session.user);
      }
    });

    const current = await PADMIN.auth.session();
    if (current && current.user && PADMIN.auth.isAllowed(current.user)) return showPanel(current.user);
    if (current && current.user) {
      await PADMIN.auth.signOut();
      setLoginStatus('Ese correo no está autorizado.', 'error');
    }
    showLogin();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const email = $('email').value.trim();
    const button = $('login-form').querySelector('button[type=submit]');
    button.disabled = true;
    setLoginStatus('Enviando enlace…', 'busy');
    try {
      await PADMIN.auth.signIn(email);
      setLoginStatus(`Revisa ${email}. El enlace sirve una sola vez y vence en una hora.`, 'ok');
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      setLoginStatus(/authorized|not allowed|signups/i.test(message)
        ? 'Ese correo no está autorizado para entrar.'
        : `No se pudo enviar el enlace: ${message}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  doc.addEventListener('DOMContentLoaded', () => {
    boot().catch((error) => setLoginStatus(`Error al iniciar: ${error.message}`, 'error'));

    doc.addEventListener('submit', (event) => {
      if (event.target === $('login-form')) submitLogin(event);
    });

    doc.addEventListener('input', (event) => {
      if (event.target === $('search')) {
        state.query = event.target.value;
        renderList();
      }
    });

    doc.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-action]');
      if (action) {
        try {
          await act(action.dataset.action, action.dataset.id);
        } catch (error) {
          toast(error.message, 'error');
        }
        return;
      }
      const filter = event.target.closest('[data-filter]');
      if (filter) {
        state.filter = filter.dataset.filter;
        renderList();
        return;
      }
      if (event.target.closest('#signout')) return PADMIN.auth.signOut();
      if (event.target.closest('#import-open')) return $('import-file').click();
    });

    doc.addEventListener('change', (event) => {
      if (event.target === $('import-file') && event.target.files && event.target.files[0]) {
        importBackup(event.target.files[0]);
        event.target.value = '';
      }
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
