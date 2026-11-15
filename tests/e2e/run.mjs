// End-to-end browser tests.
// Starts a Vite dev server, drives a locally installed Chromium browser (Edge/Chrome)
// with puppeteer-core, and runs every suite in this folder.
//
//   npm run test:e2e
//   BROWSER_PATH="C:/path/to/chrome.exe" npm run test:e2e   (override browser)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import marketplace from './marketplace.test.mjs';
import studio from './studio.test.mjs';
import submit from './submit.test.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chromium-based browser found. Set BROWSER_PATH to Chrome or Edge.');
  return found;
}

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });

let pass = 0, fail = 0;
const failures = [];
const consoleErrors = new Set();

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.add(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => consoleErrors.add('pageerror: ' + e.message));
  return page;
}

// Small helper API shared by the suites.
const t = {
  base,
  newPage,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  check(name, ok, info = '') {
    if (ok) pass++; else { fail++; failures.push(name); }
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ` ${info}` : ''}`);
  },
  text: (page, sel) => page.$eval(sel, (e) => e.innerText),
  count: (page, sel) => page.$$eval(sel, (e) => e.length),
  async clickText(page, sel, label) {
    for (const el of await page.$$(sel)) {
      if ((await el.evaluate((x) => x.innerText.trim())).includes(label)) { await el.click(); return true; }
    }
    return false;
  },
  go: (page, p) => page.goto(base + p, { waitUntil: 'networkidle0' }),
};

try {
  for (const [name, suite] of [['Marketplace', marketplace], ['Studio download page', studio], ['Contribute / submit', submit]]) {
    console.log(`\n${name}`);
    try { await suite(t); } catch (e) { fail++; failures.push(`${name}: ${e.message}`); console.log(`  FAIL  suite crashed: ${e.stack}`); }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (consoleErrors.size) {
  console.log('Console errors/warnings:\n  ' + [...consoleErrors].join('\n  '));
}
if (fail || consoleErrors.size) {
  if (failures.length) console.log('Failed: ' + failures.join('; '));
  process.exit(1);
}
