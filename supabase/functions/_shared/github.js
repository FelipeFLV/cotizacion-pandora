/* Cliente mínimo de la API de GitHub para publicar con un solo commit atómico.
   No mueve la rama hasta que el árbol y el commit existen. */

const API = 'https://api.github.com';
const TIMEOUT = 8000;
const VERSION = '2022-11-28';

export function createGithub(options) {
  const opts = options || {};
  const token = opts.token || '';
  const repo = opts.repo || '';
  const branch = opts.branch || 'main';
  const fetchImpl = opts.fetchImpl || fetch;
  const apiBase = opts.apiBase || API;

  if (!token) throw new Error('Falta el token de GitHub.');
  if (!repo) throw new Error('Falta el repositorio de GitHub.');

  async function raw(method, path, body) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT) : null;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': VERSION
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      return await fetchImpl(`${apiBase}/repos/${repo}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('GitHub no respondió a tiempo.');
      throw new Error('No se pudo conectar con GitHub.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function request(method, path, body) {
    let response = await raw(method, path, body);
    if (response.status >= 500) response = await raw(method, path, body);
    if (!response.ok) throw new Error(`GitHub respondió ${response.status}.`);
    if (response.status === 204) return {};
    return response.json();
  }

  function refPath() {
    return `/git/ref/heads/${branch}`;
  }

  async function head() {
    const ref = await request('GET', refPath());
    return ref && ref.object ? ref.object.sha : '';
  }

  async function treeOf(sha) {
    const commit = await request('GET', `/git/commits/${sha}`);
    return commit && commit.tree ? commit.tree.sha : '';
  }

  async function listPaths(prefix) {
    const base = await head();
    const treeSha = await treeOf(base);
    const tree = await request('GET', `/git/trees/${treeSha}?recursive=1`);
    return (tree.tree || [])
      .filter((node) => node.type === 'blob' && String(node.path || '').startsWith(prefix))
      .map((node) => node.path);
  }

  function decodeBase64(value) {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  }

  async function readFile(path) {
    const response = await raw('GET', `/contents/${path}?ref=${encodeURIComponent(branch)}`);
    if (response.status === 404) return '';
    if (!response.ok) throw new Error(`GitHub respondió ${response.status}.`);
    const body = await response.json();
    if (!body || body.encoding !== 'base64' || !body.content) return '';
    return decodeBase64(body.content);
  }

  async function commit({ message, files, deletions }) {
    const base = await head();
    const baseTree = await treeOf(base);

    const entries = [];
    for (const file of files || []) {
      const blob = await request('POST', '/git/blobs', {
        content: file.content,
        encoding: file.encoding || 'utf8'
      });
      entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const path of deletions || []) {
      entries.push({ path, mode: '100644', type: 'blob', sha: null });
    }

    const tree = await request('POST', '/git/trees', { base_tree: baseTree, tree: entries });
    const created = await request('POST', '/git/commits', {
      message: message || 'Publicar cotización',
      tree: tree.sha,
      parents: [base]
    });
    await request('PATCH', `/git/refs/heads/${branch}`, { sha: created.sha, force: false });

    return {
      sha: created.sha,
      url: created.html_url || `https://github.com/${repo}/commit/${created.sha}`
    };
  }

  return { listPaths, readFile, commit };
}
