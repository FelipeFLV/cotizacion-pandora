/* Sirve un archivo de texto por HTTP para pegarlo en el editor SQL del panel
   de Supabase sin copiar y pegar a mano.
   Uso: node tools/serve-sql.mjs <archivo> [puerto] */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const port = Number(process.argv[3] || 4517);
if (!file) {
  console.error('Uso: node tools/serve-sql.mjs <archivo> [puerto]');
  process.exit(2);
}

const server = createServer((req, res) => {
  const body = readFileSync(file);
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store'
  });
  if (req.method === 'OPTIONS') return res.end();
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`sirviendo ${file} en http://127.0.0.1:${port}/`);
});
