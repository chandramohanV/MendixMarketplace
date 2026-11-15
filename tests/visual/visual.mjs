// Visual regression check for refactors: captures key screens and compares them pixel by pixel.
//
//   npm run visual:baseline   # capture reference screenshots
//   npm run visual:compare    # capture again and diff against the baseline (exit 1 on differences)
//
// Screenshots go to $VISUAL_DIR (default: <os tmp>/bloxmarket-visual). Each screen runs in a fresh
// browser context with fixed data, animations off and the text caret hidden, so runs are deterministic.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { startEnv } from '../support/env.mjs';

const mode = process.argv[2];
if (mode !== 'baseline' && mode !== 'compare') {
  console.error('Usage: visual.mjs baseline|compare');
  process.exit(2);
}
const DIR = process.env.VISUAL_DIR ?? path.join(os.tmpdir(), 'bloxmarket-visual');
const MAX_DIFF_RATIO = 0.001; // 0.1% of pixels

const SUBMISSIONS = [
  {
    id: 1000002, slug: '1000002-visual-pending-widget', name: 'Visual Pending Widget', type: 'Widget', category: 'User Interface',
    short: 'A pending submission used by the visual regression baseline.', version: '1.0.0', minPlatform: '11.0',
    file: { name: 'pending.mpk', size: 2048 }, license: 'MIT', repo: '', description: '', status: 'pending',
    submittedAt: '2026-11-10T10:00:00.000Z', updatedAt: '2026-11-10T10:00:00.000Z', publishAt: '2099-01-01T00:00:00.000Z',
  },
  {
    id: 1000001, slug: '1000001-visual-published-service', name: 'Visual Published Service', type: 'Service', category: 'Connectors',
    short: 'A published submission used by the visual regression baseline.', version: '2.1.0', minPlatform: '10.24',
    file: { name: 'published.zip', size: 4096 }, license: 'Apache V2', repo: '', description: '', status: 'published',
    submittedAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', publishAt: null,
  },
];

const SCREENS = [
  { name: 'explore', path: '/components', ready: '.section .card' },
  { name: 'explore-filtered', path: '/components?type=Widget&sort=az', ready: '.results-head' },
  { name: 'component-detail', path: '/components/6-community-commons', ready: '.detail-head' },
  { name: 'submit-errors', path: '/submit', ready: 'form.form', action: (p) => p.click('form.form button[type=submit]') },
  { name: 'my-submissions', path: '/my?tab=submissions', ready: '.submissions-table', storage: { 'mp.submissions': JSON.stringify(SUBMISSIONS) } },
  { name: 'studio', path: '/studio', ready: '.release-table .version-link' },
  { name: 'studio-manage', path: '/studio/manage', ready: '.manage-table .version-text' },
  {
    name: 'release-dialog', path: '/studio/manage', ready: '.manage-table .version-text',
    action: async (p) => { await p.click('button[aria-label="Edit 11.16.0"]'); await p.waitForSelector('#rf-section-0-item-0'); },
  },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const FREEZE_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';

const env = await startEnv();
const outDir = path.join(DIR, mode === 'baseline' ? 'baseline' : 'current');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(DIR, 'diff'), { recursive: true });
let failed = 0;

try {
  for (const screen of SCREENS) {
    for (const vp of VIEWPORTS) {
      const ctx = await env.browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      if (screen.storage) {
        await page.evaluateOnNewDocument((entries) => { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); }, screen.storage);
      }
      await page.goto(env.base + screen.path, { waitUntil: 'networkidle0' });
      await page.addStyleTag({ content: FREEZE_CSS });
      await page.waitForSelector(screen.ready, { timeout: 10000 });
      if (screen.action) await screen.action(page);
      await new Promise((r) => setTimeout(r, 400));
      const file = `${screen.name}-${vp.name}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      await ctx.close();

      if (mode === 'compare') {
        const basePath = path.join(DIR, 'baseline', file);
        if (!fs.existsSync(basePath)) { console.log(`  MISSING baseline ${file}`); failed++; continue; }
        const a = PNG.sync.read(fs.readFileSync(basePath));
        const b = PNG.sync.read(fs.readFileSync(path.join(outDir, file)));
        if (a.width !== b.width || a.height !== b.height) { console.log(`  FAIL  ${file}: size changed`); failed++; continue; }
        const diff = new PNG({ width: a.width, height: a.height });
        const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
        const ratio = pixels / (a.width * a.height);
        const ok = ratio <= MAX_DIFF_RATIO;
        if (!ok) { failed++; fs.writeFileSync(path.join(DIR, 'diff', file), PNG.sync.write(diff)); }
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${file}: ${pixels} px differ (${(ratio * 100).toFixed(3)}%)`);
      } else {
        console.log(`  saved ${file}`);
      }
    }
  }
} finally {
  await env.close();
}

if (mode === 'compare') {
  console.log(failed ? `\n${failed} screen(s) differ — see ${path.join(DIR, 'diff')}` : '\nNo visual differences.');
  if (failed) process.exit(1);
} else {
  console.log(`\nBaseline saved to ${outDir}`);
}
