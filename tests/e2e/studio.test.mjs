// Studio download page: hero, release types, release table (search, filter, sort, paging),
// release-notes dialog, downloads, navigation and mobile layout.
import { RELEASES, LATEST, RECOMMENDED_LTS } from '../../src/data/studio.js';

export default async function studio(t) {
  const page = await t.newPage();
  const { check, text, count, clickText, sleep, go } = t;
  const status = () => text(page, '.pager-status');
  const versions = () => page.$$eval('.version-link', (e) => e.map((x) => x.innerText));
  const dates = () => page.$$eval('.release-table tbody td[data-label="Released"]', (e) => e.map((x) => Date.parse(x.innerText)));

  await go(page, '/studio');
  check('page renders heading with LTS badge', (await text(page, 'h1')).includes('Download Studio') && (await count(page, 'h1 .rbadge-lts')) === 1);
  check('page has no sidebar', (await count(page, '.sidebar')) === 0);
  check('hero recommends latest LTS', (await text(page, '.studio-intro')).includes(`Studio ${RECOMMENDED_LTS.version}`), `(${RECOMMENDED_LTS.version})`);
  check('latest-features panel shows latest version', (await text(page, '.studio-panels')).includes(`Studio ${LATEST.version}`));
  check('Windows and Mac download buttons', (await text(page, '.hero-actions')).includes('Download for Windows') && (await text(page, '.hero-actions')).includes('Download for Mac (Beta)'));

  // Release types legend
  check('release types legend lists 4 types', (await count(page, '.type-row')) === 4);
  await page.click('.release-types-toggle'); await sleep(100);
  check('release types collapse', (await count(page, '.type-row')) === 0 && (await page.$eval('.release-types-toggle', (e) => e.getAttribute('aria-expanded'))) === 'false');
  await page.click('.release-types-toggle'); await sleep(100);

  // Table
  check('table shows 10 rows', (await count(page, '.release-table tbody tr')) === 10);
  check('pager shows "1 to 10 of N"', (await status()) === `1 to 10 of ${RELEASES.length}`, `(${await status()})`);
  const v = await versions();
  check('LATEST badge on latest release row', (await page.$$eval('.release-table tbody tr', (rows) => rows.filter((r) => r.querySelector('.rbadge-latest')).map((r) => r.querySelector('.version-link').innerText))).join() === LATEST.version);
  check('default order is version descending', v[0] === '11.17.0' && v.indexOf(LATEST.version) === 1, `(${v.slice(0, 3)})`);
  check('LTS / MTS / BETA badges render', (await count(page, '.release-table .rbadge-lts')) > 0 && (await count(page, '.release-table .rbadge-beta')) === 1);

  await page.click('.table-pager [aria-label="Next page"]'); await sleep(150);
  check('next page', (await status()).startsWith('11 to 20') && page.url().includes('page=2'));
  await page.click('.table-pager [aria-label="Last page"]'); await sleep(150);
  const last = RELEASES.length - ((RELEASES.length - 1) % 10);
  check('last page', (await status()) === `${last} to ${RELEASES.length} of ${RELEASES.length}`, `(${await status()})`);
  check('next/last disabled on last page', await page.$eval('.table-pager [aria-label="Next page"]', (b) => b.disabled));
  await page.click('.table-pager [aria-label="First page"]'); await sleep(150);
  check('first page', (await status()).startsWith('1 to 10'));

  // Sort by release date
  await page.click('.th-sort'); await sleep(150);
  let d = await dates();
  check('sort by date: newest first', d.every((x, i) => i === 0 || d[i - 1] >= x) && (await page.$eval('th[aria-sort]', (e) => e.getAttribute('aria-sort'))) === 'descending');
  await page.click('.th-sort'); await sleep(150);
  d = await dates();
  check('sort by date: oldest first', d.every((x, i) => i === 0 || d[i - 1] <= x) && (await versions())[0].startsWith('9.0'));
  await page.click('.th-sort'); await sleep(150);
  check('sort resets to version order', (await versions())[0] === '11.17.0');

  // Search + supported version filter
  await page.type('.input-icon input', '10.24'); await sleep(200);
  const expected = RELEASES.filter((r) => r.version.includes('10.24')).length;
  check('search by version number (fast typing keeps every character)', (await page.$eval('.input-icon input', (e) => e.value)) === '10.24' && (await status()).endsWith(`of ${expected}`) && (await versions()).every((x) => x.includes('10.24')), `(${await status()})`);
  await sleep(400);
  check('search term synced to URL', new URL(page.url()).searchParams.get('q') === '10.24');
  await page.$eval('.input-icon input', (e) => { e.select(); });
  await page.keyboard.press('Backspace'); await sleep(200);
  await page.select('.release-controls select', '9.24'); await sleep(200);
  const v924 = await versions();
  check('supported version filter (9.24 LTS)', v924.length === 10 && v924.every((x) => x.startsWith('9.24.')), `(${await status()})`);
  check('9.x has no Mac download', (await count(page, '.dl-na')) === 10);
  await page.type('.input-icon input', 'zzz'); await sleep(200);
  check('empty state with clear action', (await count(page, '.no-rows')) === 1 && (await status()) === '0 to 0 of 0');
  await clickText(page, '.no-rows button', 'Clear filters'); await sleep(200);
  check('clear filters restores full list', (await status()) === `1 to 10 of ${RELEASES.length}`);

  // Release notes dialog
  await page.click('.release-table tbody tr:nth-child(2) .notes-link'); await sleep(200);
  check('release notes dialog opens', (await count(page, '[role=dialog]')) === 1 && (await text(page, '.modal-head h2')).includes(LATEST.version));
  check('dialog lists notes', (await count(page, '.notes-section li')) >= 2);
  await page.keyboard.press('Escape'); await sleep(150);
  check('Escape closes dialog', (await count(page, '[role=dialog]')) === 0);
  await page.click('.release-table tbody tr:nth-child(3) .version-link'); await sleep(150);
  await clickText(page, '.modal .btn', 'Download for Windows'); await sleep(200);
  check('download from dialog closes it and shows toast', (await count(page, '[role=dialog]')) === 0 && (await text(page, '.toast')).includes('for Windows'));

  // Downloads + video
  await sleep(2900);
  await page.click('.release-table tbody tr:nth-child(1) .dl-link'); await sleep(150);
  check('row Mac download shows toast', (await text(page, '.toast')).includes('11.17.0 for MacOS'));
  await page.click('.video-card'); await sleep(150);
  check('video card opens player dialog', (await text(page, '.modal')).includes("isn't available"));
  await page.mouse.click(5, 5); await sleep(150);
  check('clicking backdrop closes dialog', (await count(page, '[role=dialog]')) === 0);

  // Navigation into the page
  await go(page, '/components');
  await clickText(page, '.nav-item', 'Download Studio'); await sleep(300);
  check('sidebar link navigates to /studio', new URL(page.url()).pathname === '/studio');
  await go(page, '/components');
  await clickText(page, '.promo .btn', 'Download Studio'); await sleep(300);
  check('promo button navigates to /studio', new URL(page.url()).pathname === '/studio');
  await go(page, '/link/studiopro');
  check('/link/studiopro redirects', new URL(page.url()).pathname === '/studio');
  await page.close();

  // Mobile
  const m = await t.newPage({ width: 390, height: 844 });
  await go(m, '/studio');
  check('mobile: no horizontal scroll', !(await m.evaluate(() => document.querySelector('.main-scroll').scrollWidth > innerWidth)));
  check('mobile: table rows stack as cards', (await m.$eval('.release-table thead', (e) => getComputedStyle(e).display)) === 'none');
  await m.close();
}
