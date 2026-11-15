// Shared test environment: Studio API (throwaway data) + Vite dev server + headless Chromium.
// Used by the e2e runner and the visual regression script. Run with tsx (imports TypeScript).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { launch } from 'puppeteer-core';
import { startServer } from '../../server/server.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chromium-based browser found. Set BROWSER_PATH to Chrome or Edge.');
  return found;
}

/** Starts API + Vite + browser. Call `close()` when done. */
export async function startEnv() {
  const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bloxmarket-test-'));
  const api = await startServer({ port: 0, dataDir });
  process.env.API_URL = api.url; // read by vite.config.js for the /api proxy
  const vite = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
  await vite.listen();
  const base = vite.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await launch({
    executablePath: findBrowser(),
    headless: true,
    args: process.env.CI ? ['--no-sandbox'] : [],
  });
  return {
    base,
    apiBase: `${api.url}/api/studio`,
    browser,
    async close() {
      await browser.close();
      await vite.close();
      await api.close();
      await fs.promises.rm(dataDir, { recursive: true, force: true });
    },
  };
}
