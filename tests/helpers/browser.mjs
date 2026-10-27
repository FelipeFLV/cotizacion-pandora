import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE
  || `${process.env.HOME}/.local/node/lib/node_modules/@playwright/mcp/node_modules/playwright-core`;
const { chromium } = require(playwrightPath);

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true });
}

export function watch(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()}`));
  return errors;
}
