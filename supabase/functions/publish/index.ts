/* Edge Function de publicación: sesión, auditoría y respuesta HTTP.
   La lógica vive en `_shared/publish-core.js` para poder probarla sin Deno. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { createGithub } from '../_shared/github.js';
import { publishQuote } from '../_shared/publish-core.js';
import { TEMPLATE } from '../_shared/template.js';
import { cors, json, requireUser, HttpError } from '../_shared/http.js';

const env = (key: string) => Deno.env.get(key) || '';

function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const allowed = env('ALLOWED_ORIGIN');
  if (origin && origin !== allowed) return json(403, { error: 'Origen no autorizado.' }, '');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(allowed) });
  }
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' }, allowed);

  const supabase = adminClient();
  let jobId = '';

  try {
    const user = await requireUser(req, supabase, env('ALLOWED_EMAIL'));
    const body = await req.json().catch(() => ({}));
    const quoteId = String(body.quoteId || '');
    if (!quoteId) throw new HttpError(400, 'Falta la cotización que se quiere publicar.');

    const { data: job } = await supabase
      .from('publish_jobs')
      .insert({ quote_id: quoteId, owner_id: user.id, status: 'running' })
      .select()
      .single();
    jobId = (job && job.id) || '';

    const result = await publishQuote({
      supabase,
      github: createGithub({
        token: env('GITHUB_TOKEN'),
        repo: env('GITHUB_REPO'),
        branch: env('GITHUB_BRANCH') || 'main'
      }),
      template: TEMPLATE,
      siteBase: env('SITE_BASE'),
      user,
      quoteId,
      now: new Date().toISOString()
    });

    if (jobId) {
      await supabase
        .from('publish_jobs')
        .update({ status: 'ok', url: result.url, finished_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    return json(200, { url: result.url, commit: result.commit }, allowed);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'No se pudo publicar la cotización.';
    if (jobId) {
      await supabase
        .from('publish_jobs')
        .update({ status: 'error', error: message.slice(0, 500), finished_at: new Date().toISOString() })
        .eq('id', jobId);
    }
    return json(status, { error: message }, allowed);
  }
});
