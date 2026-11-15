// End-to-end browser tests (run with tsx so the TypeScript API server can be imported).
// Starts the Studio API and a Vite dev server, drives a locally installed Chromium browser (Edge/Chrome)
// with puppeteer-core, and runs every suite in this folder.
//
//   npm run test:e2e
//   BROWSER_PATH="C:/path/to/chrome.exe" npm run test:e2e   (override browser)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { launch } from 'puppeteer-core';
import marketplace from './marketplace.test.mjs';
import studio from './studio.test.mjs';
import submit from './submit.test.mjs';
import studioManage from './studio-manage.test.mjs';
import { startServer } from '../../server/server.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function findBrowser() {
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

// Studio API on a random port with throwaway data; Vite proxies /api to it (see vite.config.js).
const dataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'studio-e2e-'));
const api = await startServer({ port: 0, dataDir });
process.env.API_URL = api.url;

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await launch({ executablePath: findBrowser(), headless: true });

let pass = 0,
  fail = 0;
const failures = [];
const consoleErrors = new Set();
// Console errors a suite has declared as expected (e.g. Chrome logging a deliberate 409 response).
const allowed = [];

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text().slice(0, 300);
    if (!allowed.some((re) => re.test(text))) consoleErrors.add(text);
  });
  page.on('pageerror', (e) => consoleErrors.add('pageerror: ' + e.message));
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Small helper API shared by the suites.
const t = {
  base,
  /** Studio API base URL, for reading expected values directly from the server. */
  api: `${api.url}/api/studio`,
  newPage,
  sleep,
  /** Polls `fn` until it returns truthy or the timeout passes. */
  async waitFor(fn, timeout = 5000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (await fn()) return true;
      } catch {
        /* retry */
      }
      await sleep(60);
    }
    return false;
  },
  /** Runs `fn` while console errors matching `pattern` are expected (and therefore ignored). */
  async expectConsoleErrors(pattern, fn) {
    allowed.push(pattern);
    try {
      return await fn();
    } finally {
      await sleep(300);
      allowed.splice(allowed.indexOf(pattern), 1);
    }
  },
  check(name, ok, info = '') {
    if (ok) pass++;
    else {
      fail++;
      failures.push(name);
    }
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ` ${info}` : ''}`);
  },
  text: (page, sel) => page.$eval(sel, (e) => e.innerText),
  count: (page, sel) => page.$$eval(sel, (e) => e.length),
  async clickText(page, sel, label) {
    for (const el of await page.$$(sel)) {
      if ((await el.evaluate((x) => x.innerText.trim())).includes(label)) {
        await el.click();
        return true;
      }
    }
    return false;
  },
  go: (page, p) => page.goto(base + p, { waitUntil: 'networkidle0' }),
};

try {
  for (const [name, suite] of [
    ['Marketplace', marketplace],
    ['Studio download page', studio],
    ['Contribute / submit', submit],
    ['Studio — manage releases', studioManage],
  ]) {
    console.log(`\n${name}`);
    try {
      await suite(t);
    } catch (e) {
      fail++;
      failures.push(`${name}: ${e.message}`);
      console.log(`  FAIL  suite crashed: ${e.stack}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
  await api.close();
  await fs.promises.rm(dataDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (consoleErrors.size) {
  console.log('Console errors/warnings:\n  ' + [...consoleErrors].join('\n  '));
}
if (fail || consoleErrors.size) {
  if (failures.length) console.log('Failed: ' + failures.join('; '));
  process.exit(1);
}
