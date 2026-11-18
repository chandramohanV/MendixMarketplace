// Sign-in API and role rules: who may read and who may write each protected area.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountsFromEnv,
  authenticate,
  createSessionToken,
  DEFAULT_ACCOUNTS,
  readSessionToken,
} from '../../server/auth';
import type { Session } from '../../shared/auth';
import type { ApiErrorBody } from '../../shared/studio';
import { requestJson, signIn, startTestServer, type TestServer } from './helpers';

let env: TestServer;
let userCookie: string;
let adminCookie: string;

const api = (path: string) => `${env.url}/api${path}`;
const login = (username: string, password: string) =>
  requestJson<Session & ApiErrorBody>(api('/auth/login'), 'POST', { body: { username, password } });
const errorCode = (body: unknown) => (body as ApiErrorBody).error.code;

before(async () => {
  env = await startTestServer();
  userCookie = await signIn(env.url, 'user');
  adminCookie = await signIn(env.url, 'admin');
});
after(() => env.close());

describe('default accounts', () => {
  test('there is one normal user and one admin', () => {
    assert.deepEqual(
      DEFAULT_ACCOUNTS.map((a) => [a.username, a.password, a.role]),
      [
        ['user', 'user123', 'user'],
        ['admin', 'admin123', 'admin'],
      ],
    );
  });
  test('env vars override the default passwords', () => {
    const accounts = accountsFromEnv({ ADMIN_PASSWORD: 's3cret' });
    assert.equal(accounts.find((a) => a.role === 'admin')?.password, 's3cret');
    assert.equal(accounts.find((a) => a.role === 'user')?.password, 'user123');
  });
  test('authenticate matches username and password exactly', async () => {
    assert.deepEqual(await authenticate(DEFAULT_ACCOUNTS, { username: 'admin', password: 'admin123' }), {
      username: 'admin',
      role: 'admin',
    });
    assert.equal(await authenticate(DEFAULT_ACCOUNTS, { username: 'admin', password: 'user123' }), null);
    assert.equal(await authenticate(DEFAULT_ACCOUNTS, { username: 'nobody', password: '' }), null);
  });
});

describe('session tokens', () => {
  const user = { username: 'user', role: 'user' } as const;
  test('round-trip with the same secret', async () => {
    const token = await createSessionToken(user, 'secret-a', Math.floor(Date.now() / 1000));
    assert.deepEqual(await readSessionToken(token, 'secret-a'), user);
  });
  test('are rejected with another secret, when expired, or when missing', async () => {
    const now = Math.floor(Date.now() / 1000);
    assert.equal(await readSessionToken(await createSessionToken(user, 'secret-a', now), 'secret-b'), null);
    assert.equal(await readSessionToken(await createSessionToken(user, 'secret-a', now - 9 * 3600), 'secret-a'), null);
    assert.equal(await readSessionToken(undefined, 'secret-a'), null);
    assert.equal(await readSessionToken('not-a-token', 'secret-a'), null);
  });
});

describe('POST /api/auth/login', () => {
  test('signs in with valid credentials and sets an HttpOnly cookie', async () => {
    const r = await login('admin', 'admin123');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.user, { username: 'admin', role: 'admin' });
    const cookie = r.headers.get('set-cookie') ?? '';
    assert.match(cookie, /^session=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });
  test('rejects a wrong password with 401 and no cookie', async () => {
    const r = await login('admin', 'wrong');
    assert.equal(r.status, 401);
    assert.equal(errorCode(r.body), 'invalid_credentials');
    assert.equal(r.headers.get('set-cookie'), null);
  });
  test('rejects an empty body with 422 field errors', async () => {
    const r = await login('', '');
    assert.equal(r.status, 422);
    assert.deepEqual(
      (r.body as ApiErrorBody).error.details?.map((d) => d.field),
      ['username', 'password'],
    );
  });
});

describe('GET /api/auth/me and logout', () => {
  test('returns null when signed out (200, so browsers log no error)', async () => {
    const r = await requestJson<Session>(api('/auth/me'), 'GET');
    assert.equal(r.status, 200);
    assert.equal(r.body.user, null);
  });
  test('returns the signed-in user', async () => {
    const r = await requestJson<Session>(api('/auth/me'), 'GET', { cookie: userCookie });
    assert.deepEqual(r.body.user, { username: 'user', role: 'user' });
  });
  test('logout expires the cookie', async () => {
    const r = await requestJson(api('/auth/logout'), 'POST', { cookie: userCookie });
    assert.equal(r.status, 204);
    assert.match(r.headers.get('set-cookie') ?? '', /session=;.*Max-Age=0/i);
  });
});

describe('access rules', () => {
  const release = { version: '12.9.0', date: '2026-11-01' };

  for (const path of ['/studio/health', '/studio/summary', '/studio/releases']) {
    test(`GET ${path} stays public (the Claude Desktop MCP server reads it)`, async () => {
      assert.equal((await requestJson(api(path), 'GET')).status, 200);
    });
  }
  for (const path of ['/components', '/components/1-excel-importer']) {
    test(`GET ${path} needs a session`, async () => {
      const anonymous = await requestJson(api(path), 'GET');
      assert.equal(anonymous.status, 401);
      assert.equal(errorCode(anonymous.body), 'unauthenticated');
      assert.equal((await requestJson(api(path), 'GET', { cookie: userCookie })).status, 200);
      assert.equal((await requestJson(api(path), 'GET', { cookie: adminCookie })).status, 200);
    });
  }
  test('a normal user cannot write releases (403); an admin can', async () => {
    const asUser = await requestJson(api('/studio/releases'), 'POST', { body: release, cookie: userCookie });
    assert.equal(asUser.status, 403);
    assert.equal(errorCode(asUser.body), 'forbidden');
    const asAdmin = await requestJson(api('/studio/releases'), 'POST', { body: release, cookie: adminCookie });
    assert.equal(asAdmin.status, 201);
  });
  test('a normal user cannot delete releases or components', async () => {
    const releaseDelete = await requestJson(api('/studio/releases/12.9.0'), 'DELETE', { cookie: userCookie });
    assert.equal(releaseDelete.status, 403);
    const componentDelete = await requestJson(api('/components/1-excel-importer'), 'DELETE', { cookie: userCookie });
    assert.equal(componentDelete.status, 403);
  });
  test('writes without a session are 401, not 403', async () => {
    assert.equal((await requestJson(api('/studio/releases'), 'POST', { body: release })).status, 401);
  });
});
