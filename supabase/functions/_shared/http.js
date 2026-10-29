/* Utilidades HTTP de las Edge Functions: CORS acotado y sesión obligatoria. */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

export function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(origin))
  });
}

export async function requireUser(req, supabase, allowedEmail) {
  const header = req.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Falta la sesión.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) throw new HttpError(401, 'Sesión no válida.');

  const email = String(data.user.email || '').toLowerCase();
  if (!allowedEmail || email !== String(allowedEmail).toLowerCase()) {
    throw new HttpError(403, 'Ese correo no está autorizado.');
  }
  return data.user;
}
