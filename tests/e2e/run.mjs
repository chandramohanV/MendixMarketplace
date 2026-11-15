// End-to-end browser tests (run with tsx so the TypeScript API server can be imported).
// Starts the Studio API and a Vite dev server (tests/support/env.mjs), drives a locally installed
// Chromium browser (Edge/Chrome) with puppeteer-core, and runs every suite in this folder.
//
//   npm run test:e2e
//   BROWSER_PATH="C:/path/to/chrome.exe" npm run test:e2e   (override browser)
import { startEnv } from '../support/env.mjs';
import { clickText, count, sleep, text, waitFor } from './helpers.mjs';
import marketplace from './marketplace.test.mjs';
import studioManage from './studio-manage.test.mjs';
import studio from './studio.test.mjs';
import submit from './submit.test.mjs';

const SUITES = [
  ['Marketplace', marketplace],
  ['Studio download page', studio],
  ['Contribute / submit', submit],
  ['Studio — manage releases', studioManage],
];

const env = await startEnv();
let pass = 0;
let fail = 0;
const failures = [];
const consoleErrors = new Set();
// Console errors a suite has declared as expected (e.g. Chrome logging a deliberate 409 response).
const allowed = [];

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const page = await env.browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const message = m.text().slice(0, 300);
    if (!allowed.some((re) => re.test(message))) consoleErrors.add(message);
  });
  page.on('pageerror', (e) => consoleErrors.add('pageerror: ' + e.message));
  return page;
}

/** What every suite receives. */
const t = {
  base: env.base,
  /** Studio API base URL, for reading expected values directly from the server. */
  api: env.apiBase,
  newPage,
  go: (page, path) => page.goto(env.base + path, { waitUntil: 'networkidle0' }),
  check(name, ok, info = '') {
    if (ok) pass++;
    else {
      fail++;
      failures.push(name);
    }
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ` ${info}` : ''}`);
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
  // Re-exported helpers (see helpers.mjs) so suites can destructure everything from `t`.
  sleep,
  waitFor,
  text,
  count,
  clickText,
};

try {
  for (const [name, suite] of SUITES) {
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
  await env.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (consoleErrors.size) console.log('Console errors/warnings:\n  ' + [...consoleErrors].join('\n  '));
if (fail || consoleErrors.size) {
  if (failures.length) console.log('Failed: ' + failures.join('; '));
  process.exit(1);
}
