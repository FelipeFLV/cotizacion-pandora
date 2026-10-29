/* Acceso a Supabase desde el panel: un envoltorio delgado sobre supabase-js.
   El dueño siempre sale de la sesión; nunca se envía owner_id en updates. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});
  let client = null;
  let ownerId = '';

  function ready() {
    if (!client) throw new Error('La conexión con Supabase no está inicializada.');
    return client;
  }

  function fail(error, fallback) {
    const message = error && error.message ? error.message : fallback;
    throw new Error(message || 'No se pudo completar la operación.');
  }

  async function currentUserId() {
    if (ownerId) return ownerId;
    const result = await ready().auth.getUser();
    if (result.error || !result.data || !result.data.user) {
      fail(result.error, 'No hay una sesión activa.');
    }
    ownerId = result.data.user.id;
    return ownerId;
  }

  async function one(query, fallback) {
    const { data, error } = await query;
    if (error) fail(error, fallback);
    return data;
  }

  const api = {
    init(supabaseClient) {
      client = supabaseClient;
      ownerId = '';
      return api;
    },

    async listQuotes(options) {
      const includeArchived = Boolean(options && options.includeArchived);
      let query = ready().from('quotes').select('*').order('updated_at', { ascending: false });
      if (!includeArchived) query = query.is('archived_at', null);
      return one(query, 'No se pudieron leer las cotizaciones.');
    },

    async getQuote(id) {
      return one(
        ready().from('quotes').select('*').eq('id', id).single(),
        'No se pudo leer la cotización.'
      );
    },

    async createQuote({ data, isTemplate }) {
      const owner = await currentUserId();
      const quote = data || {};
      const meta = quote.meta || {};
      const row = {
        owner_id: owner,
        data: quote,
        slug: meta.slug || null,
        status: 'draft',
        is_template: Boolean(isTemplate)
      };
      return one(
        ready().from('quotes').insert(row).select().single(),
        'No se pudo crear la cotización.'
      );
    },

    async saveQuote(id, quote) {
      const patch = PADMIN.model.quoteToPatch(quote);
      return one(
        ready().from('quotes').update(patch).eq('id', id).select().single(),
        'No se pudo guardar la cotización.'
      );
    },

    async archiveQuote(id) {
      return one(
        ready().from('quotes').update({ archived_at: new Date().toISOString() }).eq('id', id).select().single(),
        'No se pudo archivar la cotización.'
      );
    },

    async unarchiveQuote(id) {
      return one(
        ready().from('quotes').update({ archived_at: null }).eq('id', id).select().single(),
        'No se pudo restaurar la cotización.'
      );
    },

    async setTemplate(id) {
      const current = await one(
        ready().from('quotes').select('id').eq('is_template', true).maybeSingle(),
        'No se pudo leer la plantilla actual.'
      );
      if (current && current.id === id) return current;

      if (current) {
        await one(
          ready().from('quotes').update({ is_template: false }).eq('id', current.id),
          'No se pudo quitar la marca de plantilla anterior.'
        );
      }
      try {
        return await one(
          ready().from('quotes').update({ is_template: true }).eq('id', id).select().single(),
          'No se pudo marcar la plantilla.'
        );
      } catch (error) {
        if (current) {
          await ready().from('quotes').update({ is_template: true }).eq('id', current.id).then(
            () => {},
            () => {}
          );
        }
        throw error;
      }
    },

    async duplicateRow(row, changes) {
      const owner = await currentUserId();
      const data = JSON.parse(JSON.stringify(row.data || {}));
      const meta = (data.meta = data.meta || {});
      Object.assign(meta, {
        slug: '',
        publishedUrl: '',
        publishedAt: '',
        retiredAt: '',
        retireRequestedAt: '',
        isDraft: false
      });
      const copy = Object.assign({
        owner_id: owner,
        data,
        slug: null,
        status: 'draft',
        is_template: false,
        published_url: '',
        published_at: null,
        retired_at: null,
        archived_at: null
      }, changes || {});
      return one(ready().from('quotes').insert(copy).select().single(), 'No se pudo duplicar la cotización.');
    },

    async duplicateQuote(id) {
      const row = await api.getQuote(id);
      return api.duplicateRow(row);
    },

    async newClientFrom(id) {
      const row = await api.getQuote(id);
      const data = PADMIN.model.newClientData(row.data);
      return api.createQuote({ data, isTemplate: false });
    },

    async listVersions(quoteId) {
      return one(
        ready().from('quote_versions').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false }),
        'No se pudo leer el historial.'
      );
    },

    async createVersion(quoteId, label, published) {
      const owner = await currentUserId();
      const row = await api.getQuote(quoteId);
      return one(
        ready().from('quote_versions').insert({
          quote_id: quoteId,
          owner_id: owner,
          data: row.data,
          label: label || '',
          published: Boolean(published)
        }).select().single(),
        'No se pudo guardar la versión.'
      );
    },

    async restoreVersion(versionId) {
      const version = await one(
        ready().from('quote_versions').select('*').eq('id', versionId).single(),
        'No se pudo leer la versión.'
      );
      return one(
        ready().from('quotes').update({ data: version.data }).eq('id', version.quote_id).select().single(),
        'No se pudo restaurar la versión.'
      );
    },

    async getMedia(ids) {
      const list = (ids || []).filter(Boolean);
      if (!list.length) return [];
      return one(
        ready().from('media').select('*').in('id', list),
        'No se pudieron leer los medios.'
      );
    },

    async signedUrl(path) {
      if (!path) return '';
      const { data, error } = await ready().storage.from('drafts').createSignedUrl(path, 3600);
      if (error) fail(error, 'No se pudo firmar la URL del medio.');
      return data && data.signedUrl ? data.signedUrl : '';
    },

    async uploadMedia(path, blob, mime) {
      const { error } = await ready().storage.from('drafts').upload(path, blob, {
        contentType: mime,
        upsert: true
      });
      if (error) fail(error, 'No se pudo subir la imagen.');
      return path;
    },

    async importBackup(json) {
      const owner = await currentUserId();
      const parsed = PADMIN.model.fromBackup(json, owner);
      const quotes = await one(
        ready().from('quotes').insert(parsed.quotes).select(),
        'No se pudieron importar las cotizaciones.'
      );
      if (parsed.versions.length) {
        await one(
          ready().from('quote_versions').insert(parsed.versions),
          'No se pudo importar el historial.'
        );
      }
      if (parsed.bank.length) {
        await one(
          ready().from('bank_items').insert(parsed.bank),
          'No se pudo importar la biblioteca de evidencias.'
        );
      }
      return { quotes, versions: parsed.versions.length, bank: parsed.bank.length };
    },

    async listBankItems() {
      return one(
        ready().from('bank_items').select('*').order('created_at', { ascending: false }),
        'No se pudo leer la biblioteca.'
      );
    },

    async addBankItem(item) {
      const owner = await currentUserId();
      return one(
        ready().from('bank_items').insert(Object.assign({ owner_id: owner }, item)).select().single(),
        'No se pudo añadir la pieza.'
      );
    },

    async removeBankItem(id) {
      const { error } = await ready().from('bank_items').delete().eq('id', id);
      if (error) fail(error, 'No se pudo quitar la pieza.');
      return true;
    },

    async listJobs(quoteId) {
      return one(
        ready().from('publish_jobs').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false }).limit(10),
        'No se pudo leer la auditoría de publicación.'
      );
    },

    reset() {
      client = null;
      ownerId = '';
    }
  };

  PADMIN.api = api;
})(typeof window !== 'undefined' ? window : globalThis);
