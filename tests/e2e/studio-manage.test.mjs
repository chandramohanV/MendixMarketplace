// Manage releases: create / edit / delete through the UI, validation (client and server),
// duplicate version, LATEST promotion on /studio, delete-LATEST refusal, API-down state, mobile.
import { apiClient, fill as fillInput, setNativeValue } from './helpers.mjs';

const NEW = '11.17.1';

export default async function studioManage(t) {
  const { check, text, count, clickText, sleep, go, waitFor } = t;
  const page = await t.newPage();
  const api = apiClient(t.api);
  const apiGet = api.get;
  const apiSend = api.send;
  const startLatest = (await apiGet('/summary')).body.latest.version;
  const TOTAL = (await apiGet('/releases?pageSize=1')).body.total;

  const err = (id) => page.$eval(`#rf-${id}-error`, (e) => e.innerText).catch(() => null);
  const invalid = (id) => page.$eval(`#rf-${id}`, (e) => e.getAttribute('aria-invalid') === 'true').catch(() => false);
  const status = () => text(page, '.pager-status');
  // Give React a moment to start the request, then wait until the table has settled.
  const loaded = async () => {
    await sleep(150);
    return waitFor(async () => !(await status()).includes('Loading') && (await count(page, '.skeleton-row')) === 0);
  };
  const dialogOpen = async () => (await count(page, '[role=dialog]')) === 1;
  const setValue = (selector, value) => setNativeValue(page, selector, value);
  const fill = (selector, value) => fillInput(page, selector, value);
  const submitForm = () => page.click('.release-form button[type=submit]');

  // Request interception lets the tests simulate an unreachable API or a crafted server response.
  let mode = 'pass';
  let crafted = null;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.isInterceptResolutionHandled()) return;
    // Match API calls only — not the Vite-served module /src/api/studio.ts.
    const isApi = new URL(req.url()).pathname.startsWith('/api/');
    if (isApi && mode === 'down') return void req.abort('failed');
    if (isApi && mode === 'craft' && req.method() === 'POST') return void req.respond(crafted);
    req.continue();
  });

  // --- Page basics ---
  await go(page, '/studio');
  await waitFor(async () => (await count(page, '.releases-head a')) === 1);
  await clickText(page, '.releases-head a', 'Manage releases');
  await waitFor(async () => new URL(page.url()).pathname === '/studio/manage');
  await loaded();
  check(
    '"Manage releases" link opens /studio/manage without sidebar',
    new URL(page.url()).pathname === '/studio/manage' &&
      (await count(page, '.sidebar')) === 0 &&
      (await text(page, 'h1')) === 'Manage releases',
  );
  check(
    'table lists releases from the API (20 per page)',
    (await count(page, '.manage-table tbody tr')) === 20 && (await status()) === `1 to 20 of ${TOTAL}`,
  );

  // --- Create: client validation ---
  await clickText(page, '.manage-head button', 'New release');
  check(
    '"New release" opens the dialog',
    (await dialogOpen()) && (await text(page, '.modal-head h2')) === 'New release',
  );
  await submitForm();
  await sleep(150);
  check('empty version is rejected inline', (await err('version'))?.includes('semantic') && (await invalid('version')));
  check(
    'focus moves to the first invalid field',
    await page.evaluate(() => document.activeElement?.id === 'rf-version'),
  );
  check(
    'date defaults to today, mac follows the version',
    (await page.$eval('#rf-date', (e) => e.value)) === new Date().toISOString().slice(0, 10),
  );
  await fill('#rf-version', '9.24.77');
  check('Mac is unchecked by default for Studio 9', !(await page.$eval('#rf-mac', (e) => e.checked)));
  await page.click('#rf-mac');
  await submitForm();
  await sleep(150);
  check('Mac for Studio 9 is rejected inline', (await err('mac'))?.includes('Studio 10'));
  await page.click('#rf-mac'); // unchecked again; the box is now "touched", so it stops following the version
  await fill('#rf-version', NEW);
  check('Mac stays as set by hand after the version changes', !(await page.$eval('#rf-mac', (e) => e.checked)));
  await page.click('#rf-mac');
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  await setValue('#rf-date', d.toISOString().slice(0, 10));
  await submitForm();
  await sleep(150);
  check('future date is rejected inline', (await err('date'))?.includes('future'));
  await setValue('#rf-date', '2026-11-13');
  await clickText(page, '.notes-editor > button', 'Add section');
  await sleep(100);
  await submitForm();
  await sleep(150);
  check(
    'empty section name and empty item are rejected inline',
    (await err('section-0-name'))?.includes('required') && (await err('section-0-item-0'))?.includes('empty'),
  );
  await page.type('#rf-section-0-name', 'Fixes');
  await page.type('#rf-section-0-item-0', 'Fixed an issue found by the end-to-end tests.');
  await clickText(page, '.notes-section-edit .text-btn', 'Add item');
  await sleep(100);
  await page.type('#rf-section-0-item-1', 'x'.repeat(301));
  await submitForm();
  await sleep(150);
  check('note item over 300 characters is rejected inline', (await err('section-0-item-1'))?.includes('300'));
  await page.click('button[aria-label="Remove item 2 from section 1"]');
  await sleep(100);

  // --- Create: server 422 mapped inline (crafted response) ---
  mode = 'craft';
  crafted = {
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({
      error: {
        code: 'validation_failed',
        message: 'The request body is invalid.',
        details: [
          { field: 'date', message: 'Server says: date rejected.' },
          { field: 'notes.Fixes.0', message: 'Server says: item rejected.' },
        ],
      },
    }),
  };
  await t.expectConsoleErrors(/status of 422/, async () => {
    await submitForm();
    await sleep(400);
  });
  mode = 'pass';
  check(
    'server 422 details are shown on the matching fields',
    (await err('date')) === 'Server says: date rejected.' &&
      (await err('section-0-item-0')) === 'Server says: item rejected.' &&
      (await invalid('date')),
  );
  await setValue('#rf-date', '2026-11-12');
  await sleep(50);
  check('editing clears server errors', (await err('date')) === null && (await err('section-0-item-0')) === null);

  // --- Create: success ---
  await submitForm();
  check(
    'create closes the dialog and shows a toast',
    await waitFor(async () => !(await dialogOpen()) && (await text(page, '.toast')).includes(`Release ${NEW} created`)),
  );
  const created = await apiGet(`/releases/${NEW}`);
  check(
    'release saved through the API with notes and derived fields',
    created.status === 200 &&
      created.body.line === '11.17' &&
      created.body.mac === true &&
      created.body.notes.Fixes?.[0] === 'Fixed an issue found by the end-to-end tests.',
  );
  await loaded();
  check(
    'list refreshes and shows the new release first',
    (await page.$eval('.manage-table tbody tr .version-text', (e) => e.innerText)) === NEW,
  );

  // --- Duplicate version → 409 form-level ---
  await clickText(page, '.manage-head button', 'New release');
  await page.type('#rf-version', startLatest);
  check('Mac defaults to checked for Studio 10+ on a fresh form', await page.$eval('#rf-mac', (e) => e.checked));
  await setValue('#rf-date', '2026-11-01');
  await t.expectConsoleErrors(/status of 409/, async () => {
    await submitForm();
    await waitFor(async () => (await count(page, '.form-alert')) === 1);
  });
  check(
    'duplicate version shows the server 409 as a form-level message',
    (await text(page, '.form-alert')).includes('already exists') && (await dialogOpen()),
  );
  await page.keyboard.press('Escape');
  await sleep(150);
  check('Escape closes the form dialog', !(await dialogOpen()));

  // --- Edit ---
  await page.click(`button[aria-label="Edit ${NEW}"]`);
  check(
    'edit dialog loads the full release',
    await waitFor(async () =>
      (await page.$eval('#rf-section-0-item-0', (e) => e.value).catch(() => '')).startsWith('Fixed an issue'),
    ),
  );
  check(
    'version is read-only when editing',
    await page.$eval('#rf-version', (e) => e.readOnly && e.value === '11.17.1'),
  );
  await fill('#rf-section-0-item-0', 'Fixed an issue (edited).');
  await clickText(page, '.notes-editor > button', 'Add section');
  await sleep(100);
  await page.type('#rf-section-1-name', 'New Features');
  await page.type('#rf-section-1-item-0', 'Added a release editor.');
  await submitForm();
  check(
    'edit saves and shows a toast',
    await waitFor(async () => !(await dialogOpen()) && (await text(page, '.toast')).includes(`Release ${NEW} updated`)),
  );
  const edited = (await apiGet(`/releases/${NEW}`)).body;
  check(
    'edit persisted via PUT',
    edited.notes.Fixes[0] === 'Fixed an issue (edited).' &&
      edited.notes['New Features'][0] === 'Added a release editor.',
  );

  // --- Promote to LATEST and see it on /studio ---
  await loaded();
  await page.click(`button[aria-label="Edit ${NEW}"]`);
  await waitFor(async () => (await count(page, '#rf-type')) === 1);
  await page.select('#rf-type', 'LATEST');
  await submitForm();
  await waitFor(async () => !(await dialogOpen()));
  check(
    'promoting to LATEST demotes the previous LATEST',
    (await apiGet('/summary')).body.latest.version === NEW &&
      (await apiGet(`/releases/${startLatest}`)).body.type !== 'LATEST',
  );
  await go(page, '/studio');
  check(
    '/studio shows the new LATEST in the hero panel and table',
    (await waitFor(async () => (await text(page, '.studio-panels')).includes(`Studio ${NEW}`))) &&
      (await waitFor(
        async () =>
          (
            await page.$$eval('.release-table tbody tr', (rows) =>
              rows
                .filter((r) => r.querySelector('.rbadge-latest'))
                .map((r) => r.querySelector('.version-link').innerText),
            )
          ).join() === NEW,
      )),
  );

  // --- Delete the LATEST → refused ---
  await go(page, '/studio/manage');
  await loaded();
  await page.click(`button[aria-label="Delete ${NEW}"]`);
  check(
    'delete asks for confirmation',
    (await dialogOpen()) && (await text(page, '.modal-head h2')).includes(`Delete Studio ${NEW}`),
  );
  await t.expectConsoleErrors(/status of 409/, async () => {
    await clickText(page, '.modal .btn', 'Delete release');
    await waitFor(async () => (await count(page, '.form-alert')) === 1);
  });
  check(
    'deleting the LATEST shows the server message',
    (await text(page, '.form-alert')).includes('Promote another release to LATEST') &&
      (await apiGet(`/releases/${NEW}`)).status === 200,
  );
  await clickText(page, '.modal .btn', 'Cancel');
  await sleep(150);

  // --- Delete a normal release ---
  check(
    'restore previous LATEST (setup via API)',
    (await apiSend('PATCH', `/releases/${startLatest}`, { type: 'LATEST' })) === 200,
  );
  await page.reload({ waitUntil: 'networkidle0' });
  await loaded();
  await page.click(`button[aria-label="Delete ${NEW}"]`);
  await clickText(page, '.modal .btn', 'Delete release');
  check(
    'delete removes the release and shows a toast',
    await waitFor(async () => !(await dialogOpen()) && (await text(page, '.toast')).includes(`Release ${NEW} deleted`)),
  );
  check(
    'deleted release is gone from the API and the list',
    (await apiGet(`/releases/${NEW}`)).status === 404 &&
      (await page.$eval('.manage-table tbody tr .version-text', (e) => e.innerText)) !== NEW,
  );

  // --- API down → error states with Retry ---
  await t.expectConsoleErrors(/net::ERR_FAILED|Failed to load resource/, async () => {
    mode = 'down';
    await go(page, '/studio/manage');
    check(
      'manage page: API down shows an error with Retry',
      (await waitFor(async () => (await count(page, '.manage-table .inline-error')) === 1)) &&
        (await text(page, '.manage-table .inline-error')).includes('Could not reach the Studio API'),
    );
    await go(page, '/studio');
    check(
      'studio page: API down shows hero and table errors with Retry',
      await waitFor(
        async () =>
          (await count(page, '.studio-intro .inline-error')) === 1 &&
          (await count(page, '.release-table .inline-error')) === 1,
      ),
    );
    mode = 'pass';
    await clickText(page, '.release-table .inline-error button', 'Retry');
    check(
      'Retry recovers the table once the API is back',
      await waitFor(
        async () =>
          (await count(page, '.release-table tbody tr')) === 10 &&
          (await count(page, '.release-table .inline-error')) === 0,
      ),
    );
    await clickText(page, '.studio-intro .inline-error button', 'Retry');
    check(
      'Retry recovers the hero',
      await waitFor(async () =>
        (await text(page, '.studio-intro')).includes(
          `Studio ${(await apiGet('/summary')).body.recommendedLts.version}`,
        ),
      ),
    );
  });
  await page.setRequestInterception(false);
  await page.close();

  // --- Mobile ---
  const m = await t.newPage({ width: 390, height: 844 });
  await go(m, '/studio/manage');
  await t.waitFor(async () => (await m.$$('.manage-table tbody tr .version-text')).length > 0);
  check(
    'mobile: manage page has no horizontal scroll',
    !(await m.evaluate(() => document.querySelector('.main-scroll').scrollWidth > innerWidth)),
  );
  await clickText(m, '.manage-head button', 'New release');
  await sleep(200);
  await clickText(m, '.notes-editor > button', 'Add section');
  await sleep(100);
  check(
    'mobile: release dialog fits the screen',
    await m.$eval('.modal', (e) => e.getBoundingClientRect().width <= innerWidth && e.scrollWidth <= e.clientWidth + 1),
  );
  await m.close();
}
