// Sign-in and roles: the login gate, wrong password, normal user (browse only) vs admin (Admin console),
// adding and editing a component through the UI, and signing out.
import { ACCOUNTS, fill, setNativeValue } from './helpers.mjs';

const NEW_NAME = 'E2E Barcode Toolkit';
const RENAMED = 'E2E Barcode Toolkit Pro';

async function signInThroughForm(page, username, password) {
  await fill(page, '#login-username', username);
  await fill(page, '#login-password', password);
  await page.click('.login-card button[type=submit]');
}

export default async function authAdmin(t) {
  const { check, text, count, clickText, sleep, go, waitFor } = t;

  // ---------- signed out ----------
  const guest = await t.newPage(undefined, { as: null });

  await go(guest, '/publishers');
  check('signed-out visitors see the login screen on any URL', (await count(guest, '.login-card')) === 1);
  check('the login screen does not reveal any password', !(await text(guest, '.login-card')).includes('admin123'));

  await guest.click('.login-card button[type=submit]');
  check(
    'empty sign-in shows field errors',
    (await text(guest, '#login-username-error')).includes('username') &&
      (await text(guest, '#login-password-error')).includes('password'),
  );

  await t.expectConsoleErrors(/401/, async () => {
    await signInThroughForm(guest, 'admin', 'wrong-password');
    check(
      'a wrong password is rejected',
      await waitFor(async () => (await text(guest, '.login-card .form-alert')).includes('Incorrect')),
    );
  });

  // ---------- normal user ----------
  await signInThroughForm(guest, ACCOUNTS.user.username, ACCOUNTS.user.password);
  check(
    'a normal user lands on the page they opened after signing in',
    await waitFor(async () => (await text(guest, 'h1')).includes('Publishers')),
  );
  check('the top bar shows the user role', (await text(guest, '.topbar-avatar')).toLowerCase() === 'user');
  check('a normal user has no Admin link', !(await clickText(guest, '.nav-item', 'Admin')));
  await go(guest, '/studio');
  await waitFor(async () => (await count(guest, '.release-table tbody tr:not(.skeleton-row)')) > 0);
  check('a normal user cannot see "Manage releases"', !(await clickText(guest, '.releases-head a', 'Manage')));
  await go(guest, '/admin');
  check('a normal user is turned away from /admin', (await text(guest, 'h1')).includes('Admins only'));
  await go(guest, '/studio/manage');
  check('a normal user is turned away from /studio/manage', (await text(guest, 'h1')).includes('Admins only'));

  await guest.click('.topbar-signout');
  check(
    'signing out returns to the login screen',
    await waitFor(async () => (await count(guest, '.login-card')) === 1),
  );
  await guest.close();

  // ---------- admin ----------
  const admin = await t.newPage();
  await go(admin, '/');
  check('the top bar shows the admin role', (await text(admin, '.topbar-avatar')).toLowerCase() === 'admin');
  await clickText(admin, '.nav-item', 'Admin');
  check(
    'the Admin link opens the admin console',
    await waitFor(async () => new URL(admin.url()).pathname === '/admin' && (await text(admin, 'h1')) === 'Admin'),
  );
  const rowsBefore = await count(admin, '.admin-table tbody tr');
  check('the admin console lists components', rowsBefore > 0, `(${rowsBefore} rows)`);

  // Add a component: an empty form is refused first, then a valid one is saved.
  await clickText(admin, '.admin-section-head button', 'New component');
  await admin.click('.component-form button[type=submit]');
  check(
    'saving an empty component shows field errors',
    (await text(admin, '#cf-name-error')).includes('Name') &&
      (await text(admin, '#cf-short-error')).includes('Short description'),
  );
  await fill(admin, '#cf-name', NEW_NAME);
  await fill(admin, '#cf-short', 'Scan barcodes from any page of your app.');
  await setNativeValue(admin, '#cf-type', 'Widget');
  await fill(admin, '#cf-tags', 'mobile, scanner');
  await admin.click('.component-form button[type=submit]');
  check(
    'a new component is saved and the dialog closes',
    await waitFor(async () => (await count(admin, '[role=dialog]')) === 0),
  );

  await fill(admin, '[aria-label="Search components"]', NEW_NAME);
  await sleep(100);
  check('the new component appears in the admin list', (await text(admin, '.admin-table tbody')).includes(NEW_NAME));

  // Edit it.
  await clickText(admin, '.admin-table button', 'Edit');
  await fill(admin, '#cf-name', RENAMED);
  await admin.click('.component-form button[type=submit]');
  await waitFor(async () => (await count(admin, '[role=dialog]')) === 0);
  check('editing renames the component', (await text(admin, '.admin-table tbody')).includes(RENAMED));

  await go(admin, `/components?q=${encodeURIComponent(RENAMED)}`);
  check(
    'the edited component shows up on Explore for everyone',
    await waitFor(async () => (await text(admin, 'main')).includes(RENAMED)),
  );

  await go(admin, '/admin');
  await clickText(admin, '.manage-head a', 'Studio Pro');
  check(
    'the admin console links to Studio Pro release management',
    await waitFor(async () => new URL(admin.url()).pathname === '/studio/manage'),
  );

  // Clean up so later runs and suites see the original catalog size.
  await go(admin, '/admin');
  await fill(admin, '[aria-label="Search components"]', RENAMED);
  await sleep(100);
  await clickText(admin, '.admin-table button', 'Delete');
  await clickText(admin, '[role=dialog] button', 'Delete component');
  await waitFor(async () => (await count(admin, '[role=dialog]')) === 0);
  check('deleting removes the component', (await text(admin, '.admin-table tbody')).includes('No components match'));
  await admin.close();
}
