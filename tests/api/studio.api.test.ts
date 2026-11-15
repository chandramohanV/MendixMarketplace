// Studio Releases API tests: a real server on a random port with a temporary data directory.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer, type RunningServer } from '../../server/server';
import {
  todayISO,
  type ApiErrorBody,
  type ReleaseList,
  type StudioRelease,
  type StudioSummary,
} from '../../shared/studio';

let srv: RunningServer;
let dir: string;
let base: string;

/**
 * Every response shape the API returns, merged into one type. Each test reads only the fields that
 * apply to the endpoint it calls; a wrong field is still caught at runtime by the assertion.
 */
type ResponseBody = ReleaseList & StudioRelease & StudioSummary & ApiErrorBody & { ok: boolean };

interface Res {
  status: number;
  headers: Headers;
  /** True when the response had no body (e.g. 204). */
  empty: boolean;
  body: ResponseBody;
}

async function call(
  method: string,
  p: string,
  payload?: unknown,
  opts: { raw?: string; headers?: Record<string, string> } = {},
): Promise<Res> {
  const hasBody = payload !== undefined || opts.raw !== undefined;
  const res = await fetch(base + p, {
    method,
    headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
    body: opts.raw ?? (payload !== undefined ? JSON.stringify(payload) : undefined),
  });
  const text = await res.text();
  const body = (text ? JSON.parse(text) : {}) as ResponseBody;
  return { status: res.status, headers: res.headers, empty: !text, body };
}
const get = (p: string) => call('GET', p);
const tomorrow = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const allReleases = async () => (await get('/releases?pageSize=100&page=1')).body.total as number;
const latestVersion = async () => (await get('/summary')).body.latest?.version;

function assertError(res: Res, status: number, code?: string) {
  assert.equal(res.status, status, JSON.stringify(res.body));
  assert.equal(typeof res.body?.error?.code, 'string');
  assert.equal(typeof res.body.error.message, 'string');
  if (code) assert.equal(res.body.error.code, code);
  assert.doesNotMatch(JSON.stringify(res.body), /\bat .+:\d+:\d+|node_modules|\.ts:\d+/, 'no stack traces');
}
const detailFields = (res: Res) => (res.body.error.details ?? []).map((d) => d.field);

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-api-'));
  srv = await startServer({ port: 0, dataDir: dir });
  base = `${srv.url}/api/studio`;
});
after(async () => {
  await srv.close();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('basics', () => {
  test('GET /health', async () => {
    const r = await get('/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
  });
  test('seeds 175 releases with exactly one LATEST', async () => {
    const r = await get('/releases?pageSize=100');
    assert.equal(r.body.total, 175);
    assert.equal((await get('/releases?type=LATEST')).body.total, 1);
  });
  test('unknown routes return JSON 404', async () => {
    assertError(await get('/nope'), 404, 'not_found');
    assertError(await call('GET', '/../../other'), 404, 'not_found');
  });
  test('CORS allows the Vite origin only', async () => {
    const ok = await call('GET', '/health', undefined, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const bad = await call('GET', '/health', undefined, { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
});

describe('GET /releases', () => {
  test('defaults: version descending, page 1, size 10, no notes in list items', async () => {
    const r = await get('/releases');
    assert.equal(r.status, 200);
    assert.equal(r.body.page, 1);
    assert.equal(r.body.pageSize, 10);
    assert.equal(r.body.items.length, 10);
    assert.equal(r.body.items[0].version, '11.17.0');
    assert.equal(r.body.items[1].version, '11.16.1');
    assert.ok(!('notes' in r.body.items[0]));
  });
  test('pagination edges', async () => {
    const total = await allReleases();
    const lastPage = Math.ceil(total / 10);
    const last = await get(`/releases?page=${lastPage}`);
    assert.equal(last.body.items.length, total - (lastPage - 1) * 10);
    const beyond = await get(`/releases?page=${lastPage + 1}`);
    assert.deepEqual(beyond.body.items, []);
    assert.equal(beyond.body.total, total);
    assert.equal((await get('/releases?pageSize=100')).body.items.length, 100);
    assertError(await get('/releases?pageSize=101'), 400, 'bad_query');
    assertError(await get('/releases?pageSize=0'), 400, 'bad_query');
    assertError(await get('/releases?page=0'), 400, 'bad_query');
    assertError(await get('/releases?page=abc'), 400, 'bad_query');
  });
  test('filters: q, line, type (including none)', async () => {
    const q = await get('/releases?q=10.24&pageSize=100');
    assert.ok(q.body.total > 0 && q.body.items.every((i) => i.version.includes('10.24')));
    const line = await get('/releases?line=9.24&pageSize=100');
    assert.equal(line.body.total, 41);
    assert.ok(line.body.items.every((i) => i.line === '9.24'));
    const lts = await get('/releases?type=LTS&pageSize=100');
    assert.ok(lts.body.items.every((i) => i.type === 'LTS'));
    const none = await get('/releases?type=none&pageSize=100');
    assert.ok(none.body.total > 0 && none.body.items.every((i) => i.type === null));
    assertError(await get('/releases?line=abc'), 400, 'bad_query');
    assertError(await get('/releases?type=GA'), 400, 'bad_query');
  });
  test('sorting by date both ways', async () => {
    const desc = (await get('/releases?sort=date-desc&pageSize=100')).body.items.map((i) => i.date);
    assert.deepEqual(desc, desc.toSorted().toReversed());
    const asc = (await get('/releases?sort=date-asc&pageSize=100')).body.items.map((i) => i.date);
    assert.deepEqual(asc, asc.toSorted());
    assertError(await get('/releases?sort=random'), 400, 'bad_query');
  });
  test('unknown query parameters are rejected', async () => {
    const r = await get('/releases?color=blue');
    assertError(r, 400, 'bad_query');
  });
});

describe('GET /releases/:version and /summary', () => {
  test('returns one release with notes', async () => {
    const r = await get('/releases/11.16.1');
    assert.equal(r.status, 200);
    assert.equal(r.body.version, '11.16.1');
    assert.equal(r.body.type, 'LATEST');
    assert.ok(Object.keys(r.body.notes).length > 0);
  });
  test('404 for a missing release', async () => {
    assertError(await get('/releases/1.2.3'), 404, 'not_found');
  });
  test('summary has latest, recommended LTS, supported lines and types', async () => {
    const r = await get('/summary');
    assert.equal(r.body.latest?.version, '11.16.1');
    assert.equal(r.body.recommendedLts?.type, 'LTS');
    assert.ok(r.body.supportedLines.some((l) => l.value === '9.24' && l.label === '9.24 (LTS)'));
    assert.deepEqual(Object.keys(r.body.types).toSorted(), ['BETA', 'LATEST', 'LTS', 'MTS']);
  });
});

describe('POST /releases', () => {
  test('creates with 201, Location header and derived fields', async () => {
    const r = await call('POST', '/releases', {
      version: '11.16.2',
      date: '2026-11-10',
      notes: { Fixes: ['  Fixed a thing.  '] },
    });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), '/api/studio/releases/11.16.2');
    assert.deepEqual(
      {
        major: r.body.major,
        minor: r.body.minor,
        patch: r.body.patch,
        line: r.body.line,
        type: r.body.type,
        mac: r.body.mac,
      },
      { major: 11, minor: 16, patch: 2, line: '11.16', type: null, mac: true },
    );
    assert.deepEqual(r.body.notes, { Fixes: ['Fixed a thing.'] });
    assert.equal((await get('/releases/11.16.2')).status, 200);
  });
  test('mac defaults to false below Studio 10 and cannot be true there', async () => {
    const r = await call('POST', '/releases', { version: '9.24.99', date: '2025-01-01' });
    assert.equal(r.status, 201);
    assert.equal(r.body.mac, false);
    const bad = await call('POST', '/releases', { version: '9.24.98', date: '2025-01-01', mac: true });
    assertError(bad, 422, 'validation_failed');
    assert.deepEqual(detailFields(bad), ['mac']);
  });
  test('duplicate version is a 409', async () => {
    assertError(await call('POST', '/releases', { version: '11.16.1', date: '2026-01-01' }), 409, 'conflict');
  });
  test('version must be x.y.z', async () => {
    for (const version of ['11.16', '11.16.1.1', 'v11.0.0', '11.a.0', '01.2.3', '']) {
      const r = await call('POST', '/releases', { version, date: '2026-01-01' });
      assertError(r, 422, 'validation_failed');
      assert.ok(detailFields(r).includes('version'), version);
    }
  });
  test('date must be a real calendar date and not in the future', async () => {
    for (const date of ['2026-02-30', '2026-13-01', '20260101', 'yesterday', tomorrow()]) {
      const r = await call('POST', '/releases', { version: '11.30.0', date });
      assertError(r, 422, 'validation_failed');
      assert.ok(detailFields(r).includes('date'), date);
    }
    assert.equal((await call('POST', '/releases', { version: '11.30.0', date: todayISO() })).status, 201);
  });
  test('notes limits: sections, items, empty items, item length', async () => {
    const six = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`S${i}`, ['x']]));
    assertError(await call('POST', '/releases', { version: '11.31.0', date: '2026-01-01', notes: six }), 422);
    const items21 = { Fixes: Array.from({ length: 21 }, (_, i) => `Fix ${i}`) };
    const r21 = await call('POST', '/releases', { version: '11.31.0', date: '2026-01-01', notes: items21 });
    assertError(r21, 422);
    assert.ok(detailFields(r21).includes('notes.Fixes'));
    const empty = await call('POST', '/releases', {
      version: '11.31.0',
      date: '2026-01-01',
      notes: { Fixes: ['ok', '   '] },
    });
    assertError(empty, 422);
    assert.ok(detailFields(empty).includes('notes.Fixes.1'));
    const long = await call('POST', '/releases', {
      version: '11.31.0',
      date: '2026-01-01',
      notes: { Fixes: ['y'.repeat(301)] },
    });
    assertError(long, 422);
    assert.ok(detailFields(long).includes('notes.Fixes.0'));
    const ok = await call('POST', '/releases', {
      version: '11.31.0',
      date: '2026-01-01',
      notes: Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`S${i}`, Array.from({ length: 20 }, () => 'z'.repeat(300))]),
      ),
    });
    assert.equal(ok.status, 201, 'exactly at the limits is accepted');
  });
  test('derived and unknown fields are rejected', async () => {
    for (const extra of [{ major: 11 }, { line: '11.40' }, { patch: 0 }, { color: 'blue' }]) {
      assertError(
        await call('POST', '/releases', { version: '11.40.0', date: '2026-01-01', ...extra }),
        422,
        'validation_failed',
      );
    }
  });
  test('malformed JSON is 400; non-object body is 422', async () => {
    assertError(await call('POST', '/releases', undefined, { raw: '{"version": ' }), 400, 'bad_json');
    assertError(await call('POST', '/releases', undefined, { raw: '' }), 400, 'bad_json');
    assertError(await call('POST', '/releases', [1, 2]), 422, 'validation_failed');
  });
});

describe('PUT and PATCH /releases/:version', () => {
  test('PUT replaces type, date, mac and notes', async () => {
    const r = await call('PUT', '/releases/11.16.2', {
      type: null,
      date: '2026-11-11',
      mac: false,
      notes: { 'New Features': ['Shiny.'] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.date, '2026-11-11');
    assert.equal(r.body.mac, false);
    assert.deepEqual(r.body.notes, { 'New Features': ['Shiny.'] });
  });
  test('PUT cannot change the version and requires all fields', async () => {
    const r = await call('PUT', '/releases/11.16.2', { version: '11.16.3', type: null, date: '2026-11-11', notes: {} });
    assertError(r, 422, 'validation_failed');
    assert.deepEqual(detailFields(r), ['version']);
    assert.equal(
      (await call('PUT', '/releases/11.16.2', { version: '11.16.2', type: null, date: '2026-11-11', notes: {} }))
        .status,
      200,
      'same version is allowed',
    );
    const missing = await call('PUT', '/releases/11.16.2', { type: null });
    assertError(missing, 422);
    assert.ok(detailFields(missing).includes('date') && detailFields(missing).includes('notes'));
    assertError(await call('PUT', '/releases/1.0.0', { type: null, date: '2026-01-01', notes: {} }), 404, 'not_found');
  });
  test('PATCH updates only what is sent', async () => {
    const original = (await get('/releases/11.16.2')).body;
    const r = await call('PATCH', '/releases/11.16.2', { date: '2026-11-12' });
    assert.equal(r.status, 200);
    assert.equal(r.body.date, '2026-11-12');
    assert.deepEqual(r.body.notes, original.notes);
    assertError(await call('PATCH', '/releases/11.16.2', {}), 422, 'validation_failed');
    assertError(await call('PATCH', '/releases/11.16.2', { version: '11.16.9' }), 422, 'validation_failed');
    assertError(await call('PATCH', '/releases/11.16.2', { date: tomorrow() }), 422, 'validation_failed');
    assertError(await call('PATCH', '/releases/1.0.0', { date: '2026-01-01' }), 404, 'not_found');
  });
});

describe('LATEST rules', () => {
  test('promoting a release demotes the previous LATEST in the same write', async () => {
    assert.equal(await latestVersion(), '11.16.1');
    const r = await call('PATCH', '/releases/11.16.2', { type: 'LATEST' });
    assert.equal(r.status, 200);
    assert.equal(await latestVersion(), '11.16.2');
    assert.equal(
      (await get('/releases/11.16.1')).body.type,
      null,
      'line 11.16 has no LTS/MTS, so it falls back to none',
    );
    assert.equal((await get('/releases?type=LATEST')).body.total, 1);
  });
  test("a demoted LATEST falls back to its line's LTS/MTS type", async () => {
    const lts = (await get('/summary')).body.recommendedLts?.version; // e.g. 11.12.5 (LTS)
    await call('PATCH', `/releases/${lts}`, { type: 'LATEST' });
    assert.equal(await latestVersion(), lts);
    await call('PATCH', '/releases/11.16.2', { type: 'LATEST' });
    assert.equal((await get(`/releases/${lts}`)).body.type, 'LTS');
  });
  test('creating a release as LATEST demotes the previous one', async () => {
    const r = await call('POST', '/releases', { version: '11.16.5', date: '2026-11-13', type: 'LATEST' });
    assert.equal(r.status, 201);
    assert.equal(await latestVersion(), '11.16.5');
    assert.equal((await get('/releases?type=LATEST')).body.total, 1);
  });
  test('the LATEST release cannot lose its type without a replacement', async () => {
    assertError(await call('PATCH', '/releases/11.16.5', { type: null }), 409, 'latest_required');
    assertError(await call('PATCH', '/releases/11.16.5', { type: 'LTS' }), 409, 'latest_required');
    assertError(
      await call('PUT', '/releases/11.16.5', { type: 'MTS', date: '2026-11-13', notes: {} }),
      409,
      'latest_required',
    );
    assert.equal(await latestVersion(), '11.16.5');
  });
  test('a BETA release cannot become LATEST', async () => {
    const r = await call('PATCH', '/releases/11.17.0', { type: 'LATEST' });
    assertError(r, 422, 'validation_failed');
    assert.deepEqual(detailFields(r), ['type']);
    assert.equal(await latestVersion(), '11.16.5');
  });
  test('deleting the LATEST release is refused with a clear message', async () => {
    const r = await call('DELETE', '/releases/11.16.5');
    assertError(r, 409, 'latest_protected');
    assert.match(r.body.error.message, /Promote another release to LATEST/);
  });
});

describe('DELETE /releases/:version', () => {
  test('deletes with 204, then 404', async () => {
    const del = await call('DELETE', '/releases/9.24.99');
    assert.equal(del.status, 204);
    assert.equal(del.empty, true, '204 has no body');
    assertError(await get('/releases/9.24.99'), 404);
    assertError(await call('DELETE', '/releases/9.24.99'), 404, 'not_found');
  });
});

describe('persistence and concurrency', () => {
  test('20 parallel creates: no lost writes, valid file, no temp files left', async () => {
    const totalBefore = await allReleases();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => call('POST', '/releases', { version: `12.0.${i}`, date: '2026-11-01' })),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      Array(20).fill(201),
    );
    assert.equal(await allReleases(), totalBefore + 20);
    const file = JSON.parse(await fs.readFile(path.join(dir, 'releases.json'), 'utf8')) as StudioRelease[];
    assert.equal(file.length, totalBefore + 20);
    assert.equal(file.filter((r) => r.version.startsWith('12.0.')).length, 20);
    assert.deepEqual(
      (await fs.readdir(dir)).filter((f) => f.endsWith('.tmp')),
      [],
    );
  });
  test('parallel conflicting creates: exactly one wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => call('POST', '/releases', { version: '12.1.0', date: '2026-11-01' })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 9);
  });
  test('a failed write does not block later writes', async () => {
    assertError(await call('DELETE', '/releases/11.16.5'), 409);
    assert.equal((await call('POST', '/releases', { version: '12.2.0', date: '2026-11-01' })).status, 201);
  });
  test('data survives a server restart', async () => {
    const total = await allReleases();
    await srv.close();
    srv = await startServer({ port: 0, dataDir: dir });
    base = `${srv.url}/api/studio`;
    assert.equal(await allReleases(), total);
    assert.equal(await latestVersion(), '11.16.5');
    assert.equal((await get('/releases/12.2.0')).status, 200);
  });
});
