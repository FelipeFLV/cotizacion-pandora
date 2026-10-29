import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = new URL('./cliente.template.html', import.meta.url);
const targetPath = new URL('../supabase/functions/_shared/template.js', import.meta.url);

const source = readFileSync(sourcePath, 'utf8');
const escaped = source
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const output = `/* Generado por tools/build-template.mjs desde tools/cliente.template.html. No editar a mano. */\nexport const TEMPLATE = \`${escaped}\`;\n`;

writeFileSync(targetPath, output);
console.log(`template.js generado (${source.length} bytes)`);
