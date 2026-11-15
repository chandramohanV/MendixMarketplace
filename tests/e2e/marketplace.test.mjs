// Marketplace: explore, filters, results, detail page, favorites, reviews, mobile.
export default async function marketplace(t) {
  const page = await t.newPage();
  const { check, text, count, clickText, sleep, go } = t;
  const resultsN = async () => parseInt(await text(page, '.results-head h2'));

  for (const [p, expect] of [['/', 'Explore BloxMarket'], ['/components', 'Explore BloxMarket'], ['/publishers', 'Publishers'], ['/submit', 'Contribute'], ['/my', 'My Marketplace'], ['/guidelines', 'Publishing'], ['/nope', 'Page not found'], ['/link/components', 'Explore BloxMarket']]) {
    await go(page, p);
    const h1 = await text(page, 'h1').catch(() => '');
    check(`page ${p}`, h1.includes(expect), `(h1="${h1}")`);
  }

  await go(page, '/components');
  check('explore shows 4 sections of 3 cards', (await count(page, '.section')) === 4 && (await count(page, '.card')) === 12);
  await clickText(page, '.filters .check', 'Widget'); await sleep(200);
  const widgets = await resultsN();
  check('content type filter switches to results view', widgets > 0 && (await count(page, '.chip')) === 1, `(${widgets})`);
  await clickText(page, '.filters .check', 'Platform'); await sleep(200);
  check('support filter narrows results', (await resultsN()) <= widgets);
  await clickText(page, '.show-more', 'Show More'); await sleep(100);
  check('category "Show More" reveals more options', (await count(page, '.filters fieldset:nth-of-type(4) .check')) > 5);
  await clickText(page, '.rating-opt', '4+ stars'); await sleep(200);
  check('rating filter adds chip', (await text(page, '.filtered-by')).includes('4+ stars'));
  await clickText(page, '.text-btn', 'Clear all'); await sleep(200);
  check('clear all returns to sections', (await count(page, '.section')) === 4);
  await page.select('.filters select', '10.24'); await sleep(200);
  check('compatibility filter', (await text(page, '.filtered-by')).includes('Studio 10.24'));

  await go(page, '/components?view=all');
  await page.select('.sort select', 'az'); await sleep(200);
  const names = await page.$$eval('.card-title', (e) => e.map((x) => x.innerText));
  check('sort A–Z', names.join() === [...names].sort((a, b) => a.localeCompare(b)).join());
  await page.click('.pagination button:last-child'); await sleep(200);
  check('pagination', page.url().includes('page=2'));
  await page.type('.hero-search input', 'connector'); await page.keyboard.press('Enter'); await sleep(300);
  check('hero search', (await resultsN()) > 0);
  await page.type('.topbar-search input', 'chart'); await page.keyboard.press('Enter'); await sleep(300);
  check('top bar search', (await text(page, '.filtered-by')).includes('chart'));

  await go(page, '/components');
  await page.click('.card .fav-btn'); await sleep(200);
  check('favorite count in sidebar', (await text(page, '.nav-count')) === '1');
  await page.click('.card'); await sleep(400);
  check('detail page opens without sidebar', (await count(page, '.detail-head')) === 1 && (await count(page, '.sidebar')) === 0);
  for (const tab of ['Documentation', 'Releases', 'Reviews', 'Developers']) {
    await clickText(page, '.tabs button', tab); await sleep(150);
    check(`detail tab ${tab}`, (await count(page, '.tab-panel')) === 1);
  }
  await clickText(page, '.tabs button', 'Reviews'); await sleep(100);
  await clickText(page, '.btn', 'Write a review'); await sleep(150);
  await page.click('.star-input button:nth-child(4)');
  await page.type('.review-form input', 'Great');
  await page.type('.review-form textarea', 'Really useful component overall.');
  await clickText(page, '.review-form .btn', 'Post review'); await sleep(200);
  check('review posted', (await text(page, '.reviews')).includes('Really useful'));
  await clickText(page, '.btn', 'Use in Studio'); await sleep(200);
  check('download toast', (await count(page, '.toast')) === 1);
  await go(page, '/my?tab=downloads');
  check('download history recorded', (await count(page, '.table tbody tr')) === 1);

  await go(page, '/components');
  await page.click('.collapse-btn'); await sleep(250);
  check('sidebar collapses', (await count(page, '.sidebar.collapsed')) === 1);
  await page.close();

  const m = await t.newPage({ width: 390, height: 800 });
  await go(m, '/components?view=all');
  check('mobile: no horizontal scroll', !(await m.evaluate(() => document.querySelector('.main-scroll').scrollWidth > innerWidth)));
  await m.click('.filters-toggle'); await sleep(300);
  check('mobile: filter drawer opens', (await count(m, '.filters.open')) === 1);
  await m.click('.close-filters'); await sleep(300);
  await m.click('.topbar .apps'); await sleep(300);
  check('mobile: sidebar menu opens', (await count(m, '.sidebar.open')) === 1);
  await m.close();
}
