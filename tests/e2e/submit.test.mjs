// Contribute flow: validation, drafts, review/edit, submit, pending → published, edit, withdraw, mobile.
import { fill as fillInput, readStorage, setFile as setFileInput } from './helpers.mjs';

const NAME = 'E2E Test Widget';
const NAME_PRO = 'E2E Test Widget Pro';
const SHORT = 'A widget created by the end-to-end test suite.';

export default async function submit(t) {
  const { check, text, count, clickText, sleep, go, waitFor } = t;
  const page = await t.newPage();

  const fieldError = (k) => page.$eval(`#f-${k}-error`, (e) => e.innerText).catch(() => null);
  const invalid = (k) => page.$eval(`#f-${k}`, (e) => e.getAttribute('aria-invalid') === 'true');
  const describedBy = (k) => page.$eval(`#f-${k}`, (e) => e.getAttribute('aria-describedby') || '');
  const currentStep = () =>
    page.$eval('.stepper li[aria-current="step"]', (e) => e.innerText.replace(/^\d+|✓/, '').trim());
  const next = () => page.click('form.form button[type=submit]');
  const fill = (selector, value) => fillInput(page, selector, value);
  const setFile = (fileName, size) => setFileInput(page, '#f-file', fileName, size);
  // Badges are uppercased with CSS and innerText reflects that, so compare case-insensitively.
  const has = async (sel, needle) => (await text(page, sel)).toLowerCase().includes(needle.toLowerCase());
  const storage = (key) => readStorage(page, key);
  const submissions = async () => (await storage('mp.submissions')) || [];

  // Fresh state; hold submissions in "pending" so checks don't race the auto-publish timer.
  await go(page, '/submit');
  await page.evaluate(() => {
    localStorage.removeItem('mp.submissions');
    localStorage.removeItem('mp.submitDraft');
    localStorage.setItem('mp.autoPublishMs', '600000');
  });
  await go(page, '/submit');
  check(
    'submit page renders step 1 of 4',
    (await text(page, 'h1')) === 'Contribute a component' &&
      (await currentStep()) === 'General' &&
      (await count(page, '.stepper li')) === 4,
  );

  // --- Step 1: General ---
  await next();
  await sleep(150);
  check(
    'empty step shows inline errors for name and short description',
    !!(await fieldError('name')) && !!(await fieldError('short')) && (await currentStep()) === 'General',
  );
  check(
    'invalid fields get aria-invalid + aria-describedby',
    (await invalid('name')) && (await describedBy('name')).includes('f-name-error'),
  );
  check('focus moves to first invalid field', await page.evaluate(() => document.activeElement?.id === 'f-name'));
  await fill('#f-name', 'ab');
  await sleep(50);
  check('name shorter than 3 characters rejected', (await fieldError('name'))?.includes('3–60'));
  await fill('#f-name', 'x'.repeat(61));
  await sleep(50);
  check('name longer than 60 characters rejected', (await fieldError('name'))?.includes('3–60'));
  await fill('#f-name', 'excel IMPORTER');
  await sleep(50);
  check('duplicate catalog name rejected (case-insensitive)', (await fieldError('name'))?.includes('already exists'));
  await fill('#f-name', NAME);
  await sleep(50);
  check('valid name clears error', (await fieldError('name')) === null && !(await invalid('name')));
  await page.select('#f-type', 'Widget');
  await page.select('#f-category', 'User Interface');
  await fill('#f-short', 'Too short');
  await sleep(50);
  check('short description under 10 characters rejected', (await fieldError('short'))?.includes('10–160'));
  check(
    'live character counter',
    (await text(page, '#f-short-count')) === '9/160' && (await describedBy('short')).includes('f-short-count'),
  );
  await fill('#f-short', 'y'.repeat(161));
  await sleep(50);
  check(
    'short description over 160 characters rejected',
    (await fieldError('short'))?.includes('10–160') && (await text(page, '#f-short-count')) === '161/160',
  );
  await fill('#f-short', SHORT);
  await sleep(50);
  await page.focus('#f-short');
  await page.keyboard.press('Enter');
  await sleep(200);
  check('Enter in a text field moves to the next step', (await currentStep()) === 'Package');

  // --- Step 2: Package ---
  await fill('#f-version', '1.0');
  await next();
  await sleep(150);
  check(
    'non-semver version rejected',
    (await fieldError('version'))?.includes('semantic') && (await currentStep()) === 'Package',
  );
  // Regression: Next was clicked while #f-version had focus; the blur error must not swallow the click.
  check(
    'missing package file rejected (Next works on first click from a focused field)',
    (await fieldError('file'))?.includes('Choose a package'),
  );
  await fill('#f-version', '1.2.3');
  await setFile('readme.txt', 120);
  await sleep(100);
  check('wrong file type rejected', (await fieldError('file'))?.includes('.mpk or .zip'));
  await setFile('huge.mpk', 51 * 1024 * 1024);
  await sleep(150);
  check('file over 50 MB rejected', (await fieldError('file'))?.includes('50 MB'));
  await setFile('e2e-widget.mpk', 2048);
  await sleep(100);
  check(
    'valid package accepted, only name + size shown',
    (await fieldError('file')) === null && (await text(page, '#f-file-meta')).includes('e2e-widget.mpk (2 KB)'),
  );
  await next();
  await sleep(150);
  check('moves to Details', (await currentStep()) === 'Details');

  // --- Step 3: Details ---
  await fill('#f-repo', 'http://example.com/repo');
  await next();
  await sleep(150);
  check(
    'non-https repository rejected',
    (await fieldError('repo'))?.includes('https://') && (await currentStep()) === 'Details',
  );
  await fill('#f-repo', 'not a url');
  await sleep(50);
  check('malformed repository URL rejected', (await fieldError('repo'))?.includes('https://'));
  await fill('#f-repo', 'https://github.com/demo/e2e-widget');
  await page.select('#f-license', 'MIT');
  await page.type('#f-description', 'First paragraph about the widget.');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Shift');
  await page.type('#f-description', 'Second paragraph.');
  await next();
  await sleep(150);

  // --- Step 4: Review ---
  check(
    'review step lists every field',
    await page.$eval(
      'form.form',
      (f, n) =>
        [
          'Name',
          'Type',
          'Category',
          'Short description',
          'Version',
          'Minimum platform',
          'Package',
          'License',
          'Repository',
          'Full description',
        ].every((k) => f.innerText.includes(k)) &&
        f.innerText.includes(n) &&
        f.innerText.includes('e2e-widget.mpk') &&
        f.innerText.includes('Widget') &&
        f.innerText.includes('MIT'),
      NAME,
    ),
  );
  await next();
  await sleep(150);
  check(
    'terms must be accepted',
    (await fieldError('terms'))?.includes('publishing guidelines') && (await currentStep()) === 'Review',
  );
  await page.click('button[aria-label="Edit General"]');
  await sleep(150);
  check(
    'review "Edit" link jumps back to the right step',
    (await currentStep()) === 'General' && (await page.$eval('#f-name', (e) => e.value)) === NAME,
  );
  await fill('#f-name', NAME_PRO);
  await next();
  await sleep(100);
  await next();
  await sleep(100);
  await next();
  await sleep(150);
  check(
    'edited value shows on review step',
    (await currentStep()) === 'Review' && (await text(page, 'form.form')).includes(NAME_PRO),
  );

  // --- Draft autosave ---
  check('draft saved to localStorage', (await storage('mp.submitDraft'))?.form?.name === NAME_PRO);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(200);
  check(
    'draft restored after reload (same step + values)',
    (await currentStep()) === 'Review' && (await text(page, 'form.form')).includes(NAME_PRO),
  );
  check('"Draft restored" toast', (await text(page, '.toast').catch(() => '')).includes('Draft restored'));

  // --- Submit (double-click creates one submission) ---
  await page.click('#f-terms');
  await page.evaluate(() => {
    const b = document.querySelector('form.form button[type=submit]');
    b.click();
    b.click();
  });
  await sleep(50);
  check(
    'submit button disabled while submitting',
    await page.$eval('form.form button[type=submit]', (b) => b.disabled && b.innerText.includes('Submitting')),
  );
  await page.click('form.form button[type=submit]').catch(() => {});
  await page.waitForSelector('.submit-done', { timeout: 4000 });
  check(
    'success screen shown',
    (await text(page, 'h1')) === 'Submission received' && (await text(page, '.submit-done')).includes(NAME_PRO),
  );
  check('double click created exactly one submission', (await submissions()).length === 1);
  const sub = (await submissions())[0];
  check(
    'submission persisted with typed fields',
    sub.status === 'pending' &&
      sub.version === '1.2.3' &&
      sub.type === 'Widget' &&
      sub.file.name === 'e2e-widget.mpk' &&
      sub.file.size === 2048 &&
      !('terms' in sub),
  );
  check('draft cleared after submit', (await storage('mp.submitDraft')) === null);
  check(
    'success links to detail page and My submissions',
    await page.$eval(
      '.submit-done',
      (e, slug) =>
        !!e.querySelector(`a[href="/components/${slug}"]`) && !!e.querySelector('a[href="/my?tab=submissions"]'),
      sub.slug,
    ),
  );

  // --- Pending: only visible to the submitter ---
  await go(page, '/my?tab=submissions');
  check(
    'My submissions lists it as pending',
    (await has('.submissions-table', NAME_PRO)) && (await has('.submissions-table', 'Pending review')),
  );
  await go(page, `/components?q=${encodeURIComponent('E2E Test')}`);
  check('pending submission not in Explore search', (await text(page, '.results-head h2')).startsWith('0 '));
  await go(page, `/components/${sub.slug}`);
  check(
    'pending detail page shows "Pending review" notice and badge',
    (await has('.alert-info', 'pending review')) && (await has('.detail-title .badge', 'Pending review')),
  );

  // --- Duplicate against own submissions ---
  await go(page, '/submit');
  await fill('#f-name', NAME_PRO.toLowerCase());
  await page.keyboard.press('Tab');
  await sleep(50); // errors appear on blur (or on Next)
  check('duplicate of own submission rejected', (await fieldError('name'))?.includes('already exists'));
  await clickText(page, '.form-title button', 'Discard draft');
  await sleep(100);

  // --- Edit (pending only) ---
  await go(page, '/my?tab=submissions');
  await clickText(page, '.actions-cell a', 'Edit');
  await sleep(300);
  check(
    'edit opens prefilled form',
    (await text(page, 'h1')) === 'Edit submission' && (await page.$eval('#f-name', (e) => e.value)) === NAME_PRO,
  );
  check('editing own name is not a duplicate', (await fieldError('name')) === null);
  await fill('#f-short', 'An updated short description for the widget.');
  await next();
  await sleep(100);
  await next();
  await sleep(100);
  await next();
  await sleep(150);
  await page.click('#f-terms');
  await next();
  await page.waitForSelector('.submit-done', { timeout: 4000 });
  check(
    'edit saves changes',
    (await text(page, 'h1')) === 'Submission updated' &&
      (await submissions())[0].short === 'An updated short description for the widget.' &&
      (await submissions()).length === 1,
  );

  // --- Auto-publish (shortened delay) ---
  await page.evaluate(() => localStorage.setItem('mp.autoPublishMs', '1500'));
  await go(page, '/my?tab=submissions');
  await clickText(page, '.actions-cell a', 'Edit');
  await sleep(300);
  await next();
  await sleep(100);
  await next();
  await sleep(100);
  await next();
  await sleep(150);
  await page.click('#f-terms');
  await next();
  await page.waitForSelector('.submit-done', { timeout: 4000 });
  check(
    'submission auto-publishes after the review delay',
    await waitFor(async () => (await submissions())[0]?.status === 'published', 5000),
  );
  check('published toast shown', (await text(page, '.toast').catch(() => '')).includes('now published'));

  // --- Published: visible in the marketplace ---
  await go(page, `/components?q=${encodeURIComponent('E2E Test')}`);
  check(
    'published submission appears in Explore search',
    (await page.$$eval('.card-title', (e) => e.map((x) => x.innerText))).includes(NAME_PRO),
  );
  await go(page, '/components?type=Widget&sort=newest');
  check(
    'appears under its type filter, first when sorted by newest',
    (await page.$eval('.card-title', (e) => e.innerText)) === NAME_PRO,
  );
  await go(page, '/components');
  check(
    'appears in "What\'s New"',
    await page.$$eval(
      '.section',
      (s) => s.find((x) => x.innerText.startsWith("What's New"))?.innerText.includes('E2E Test Widget Pro') ?? false,
    ),
  );
  await go(page, `/components?q=${encodeURIComponent('E2E Test')}`);
  await page.click('.card');
  await sleep(300);
  check(
    'opens on its detail page',
    new URL(page.url()).pathname === `/components/${sub.slug}` && (await text(page, 'h1')) === NAME_PRO,
  );
  const detail = await text(page, '.detail');
  check(
    'detail: Demo User, Community support, 0 ratings, no pending notice',
    detail.includes('Demo User') &&
      (await has('.detail-title .badge', 'Community supported')) &&
      !(await page.$('.detail-head .stars')) &&
      (await count(page, '.alert-info')) === 0,
  );
  check(
    'detail: description paragraphs rendered',
    detail.includes('First paragraph about the widget.') && detail.includes('Second paragraph.'),
  );
  await clickText(page, '.tabs button', 'Releases');
  await sleep(150);
  check(
    'detail: single release with submitted version',
    (await count(page, '.release')) === 1 && (await text(page, '.release')).includes('1.2.3'),
  );
  await go(page, '/my?tab=submissions');
  check(
    'My submissions shows Published, no Edit for published',
    (await has('.submissions-table', 'Published')) && !(await text(page, '.actions-cell')).includes('Edit'),
  );

  // --- Approve now + Withdraw on a second submission ---
  await page.evaluate(() => localStorage.setItem('mp.autoPublishMs', '600000'));
  await go(page, '/submit');
  await fill('#f-name', 'E2E Second Component');
  await fill('#f-short', 'Second component for withdraw testing.');
  await next();
  await sleep(100);
  await setFile('second.zip', 4096);
  await next();
  await sleep(100);
  await next();
  await sleep(100);
  await page.click('#f-terms');
  await next();
  await page.waitForSelector('.submit-done', { timeout: 4000 });
  const second = (await submissions()).find((s) => s.name === 'E2E Second Component');
  await go(page, '/my?tab=submissions');
  check('two submissions listed', (await count(page, '.submissions-table tbody tr')) === 2);
  await clickText(page, '.submissions-table tbody tr:first-child .actions-cell button', 'Approve now');
  await sleep(200);
  check(
    '"Approve now (demo)" publishes immediately',
    (await submissions()).find((s) => s.id === second.id)?.status === 'published',
  );
  await clickText(page, '.submissions-table tbody tr:first-child .actions-cell button', 'Withdraw');
  await sleep(100);
  check(
    'withdraw asks for confirmation',
    (await text(page, '.submissions-table tbody tr:first-child .actions-cell')).includes('Confirm withdraw') &&
      (await submissions()).length === 2,
  );
  await clickText(page, '.submissions-table tbody tr:first-child .actions-cell button', 'Confirm withdraw');
  await sleep(200);
  check(
    'withdraw removes the submission',
    (await submissions()).length === 1 && (await count(page, '.submissions-table tbody tr')) === 1,
  );
  await go(page, `/components/${second.slug}`);
  check('withdrawn component page is gone', (await text(page, 'h1')) === 'Page not found');
  await go(page, `/submit?edit=${sub.id}`);
  check('published submissions cannot be edited', (await text(page, 'h1')).includes("can't be edited"));

  // --- Draft discard ---
  await go(page, '/submit');
  await fill('#f-name', 'Draft Only Component');
  await sleep(100);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(150);
  check('draft restored into the field', (await page.$eval('#f-name', (e) => e.value)) === 'Draft Only Component');
  await clickText(page, '.form-title button', 'Discard draft');
  await sleep(150);
  check(
    'discard draft clears form and storage',
    (await page.$eval('#f-name', (e) => e.value)) === '' &&
      (await storage('mp.submitDraft')) === null &&
      (await count(page, '.form-title button')) === 0,
  );

  // --- Regression: far-future publish times must not fire immediately (setTimeout overflow) ---
  await page.evaluate(() => {
    const subs = JSON.parse(localStorage.getItem('mp.submissions') || '[]');
    subs.unshift({
      ...subs[0],
      id: 1999999,
      slug: '1999999-far-future',
      name: 'Far Future Widget',
      status: 'pending',
      publishAt: '2099-01-01T00:00:00.000Z',
    });
    localStorage.setItem('mp.submissions', JSON.stringify(subs));
  });
  await go(page, '/my?tab=submissions');
  await sleep(1000);
  check(
    'pending submission with a far-future publish time stays pending',
    (await submissions()).find((s) => s.id === 1999999)?.status === 'pending',
  );
  await page.close();

  // --- Mobile ---
  const m = await t.newPage({ width: 390, height: 844 });
  await go(m, '/submit');
  check(
    'mobile: submit form has no horizontal scroll',
    !(await m.evaluate(() => document.querySelector('.main-scroll').scrollWidth > innerWidth)),
  );
  await go(m, '/my?tab=submissions');
  check(
    'mobile: submissions table stacks, no horizontal scroll',
    (await m.$eval('.submissions-table thead', (e) => getComputedStyle(e).display)) === 'none' &&
      !(await m.evaluate(() => document.querySelector('.main-scroll').scrollWidth > innerWidth)),
  );
  await m.evaluate(() => {
    localStorage.removeItem('mp.autoPublishMs');
  });
  await m.close();
}
