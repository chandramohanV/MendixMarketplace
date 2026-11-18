// Components API (admin catalog editing): list, read, create, update, delete, validation and persistence.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { COMPONENTS } from '../../src/data/components';
import type { Component } from '../../src/types';
import type { ComponentInput, ComponentList } from '../../shared/components';
import { todayISO, type ApiErrorBody } from '../../shared/studio';
import { requestJson, signIn, startTestServer, type TestServer } from './helpers';

let env: TestServer;
let adminCookie: string;

const url = (p = '') => `${env.url}/api/components${p}`;
const asAdmin = <T = Component>(method: string, p = '', body?: unknown) =>
  requestJson<T>(url(p), method, { body, cookie: adminCookie });
const fields = (body: unknown) => ((body as ApiErrorBody).error.details ?? []).map((d) => d.field);

const VALID: ComponentInput = {
  name: 'Barcode Toolkit',
  type: 'Widget',
  category: 'Mobile',
  industry: 'Retail',
  publisher: 'Northwind Labs',
  support: 'Partner',
  license: 'Paid',
  licenseType: 'Commercial',
  price: 120,
  version: '2.1.0',
  minPlatform: '10.24',
  short: 'Scan barcodes and QR codes from any page.',
  featured: true,
  tags: ['mobile', 'scanner'],
  features: ['Camera scanning', 'Bulk mode'],
  repo: 'https://github.com/example/barcode-toolkit',
};

/** The editable fields of an existing component, as an admin would resubmit them. */
const inputFor = (c: Component): ComponentInput => ({
  name: c.name,
  type: c.type,
  category: c.category,
  industry: c.industry,
  publisher: c.publisher,
  support: c.support,
  license: c.license,
  licenseType: c.licenseType,
  price: c.price,
  version: c.version,
  minPlatform: c.minPlatform,
  short: c.short,
  featured: c.featured,
  tags: c.tags,
  features: c.features,
  repo: c.repo,
});

before(async () => {
  env = await startTestServer();
  adminCookie = await signIn(env.url, 'admin');
});
after(() => env.close());

describe('reads', () => {
  test('GET /api/components returns the seeded catalog', async () => {
    const r = await asAdmin<ComponentList>('GET');
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, COMPONENTS.length);
    assert.deepEqual(r.body.items[0], COMPONENTS[0]);
  });
  test('GET /api/components/:slug returns one component, 404 for unknown slugs', async () => {
    assert.equal((await asAdmin('GET', `/${COMPONENTS[0].slug}`)).body.name, COMPONENTS[0].name);
    const missing = await asAdmin<ApiErrorBody>('GET', '/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'not_found');
  });
});

describe('create', () => {
  test('creates a component with server-managed fields filled in', async () => {
    const r = await asAdmin('POST', '', VALID);
    assert.equal(r.status, 201);
    const created = r.body;
    const nextId = Math.max(...COMPONENTS.map((c) => c.id)) + 1;
    assert.equal(created.id, nextId);
    assert.equal(created.slug, `${nextId}-barcode-toolkit`);
    assert.equal(r.headers.get('location'), `/api/components/${created.slug}`);
    assert.equal(created.publisherVerified, true);
    assert.equal(created.publisherCountry, 'Netherlands');
    assert.deepEqual(created.compatible, ['11.5', '11.0', '10.24']);
    assert.equal(created.rating, 0);
    assert.equal(created.created, todayISO());
    assert.deepEqual(created.releases, [
      { version: '2.1.0', date: todayISO(), minPlatform: '10.24', notes: ['Initial release.'] },
    ]);
    assert.equal((await asAdmin<ComponentList>('GET')).body.items.length, COMPONENTS.length + 1);
  });
  test('rejects a duplicate name (case-insensitive) with 409 on the name field', async () => {
    const r = await asAdmin('POST', '', { ...VALID, name: 'barcode TOOLKIT' });
    assert.equal(r.status, 409);
    assert.deepEqual(fields(r.body), ['name']);
  });
  test('validates each field', async () => {
    const r = await asAdmin('POST', '', {
      ...VALID,
      name: 'ab',
      version: 'v2',
      repo: 'http://insecure.example',
      publisher: 'Unknown Corp',
    });
    assert.equal(r.status, 422);
    assert.deepEqual(fields(r.body).toSorted(), ['name', 'publisher', 'repo', 'version']);
  });
  test('free components cost 0 and paid ones more than 0', async () => {
    const freeWithPrice = await asAdmin('POST', '', { ...VALID, name: 'Free Thing', license: 'Free', price: 10 });
    assert.deepEqual(fields(freeWithPrice.body), ['price']);
    const paidForFree = await asAdmin('POST', '', { ...VALID, name: 'Paid Thing', license: 'Paid', price: 0 });
    assert.deepEqual(fields(paidForFree.body), ['price']);
  });
  test('rejects read-only fields such as rating', async () => {
    const r = await asAdmin('POST', '', { ...VALID, name: 'Rating Hacker', rating: 5 });
    assert.equal(r.status, 422);
  });
});

describe('update and delete', () => {
  const target = COMPONENTS[1];

  test('updates editable fields and keeps the slug, reviews and ratings', async () => {
    const r = await asAdmin('PUT', `/${target.slug}`, { ...inputFor(target), name: 'Renamed Grid' });
    assert.equal(r.status, 200);
    assert.equal(r.body.name, 'Renamed Grid');
    assert.equal(r.body.slug, target.slug);
    assert.deepEqual(r.body.reviews, target.reviews);
    assert.equal(r.body.rating, target.rating);
    assert.equal(r.body.releases.length, target.releases.length, 'same version adds no release');
  });
  test('a new version adds a release entry', async () => {
    const r = await asAdmin('PUT', `/${target.slug}`, { ...inputFor(target), name: 'Renamed Grid', version: '99.0.0' });
    assert.equal(r.body.releases[0].version, '99.0.0');
    assert.equal(r.body.releases.length, target.releases.length + 1);
  });
  test('keeps its own name without a conflict, but not another component’s', async () => {
    const own = await asAdmin('PUT', `/${target.slug}`, { ...inputFor(target), name: 'renamed grid' });
    assert.equal(own.status, 200);
    const taken = await asAdmin('PUT', `/${target.slug}`, { ...inputFor(target), name: COMPONENTS[2].name });
    assert.equal(taken.status, 409);
  });
  test('PUT and DELETE on unknown slugs are 404', async () => {
    assert.equal((await asAdmin('PUT', '/nope', inputFor(target))).status, 404);
    assert.equal((await asAdmin('DELETE', '/nope')).status, 404);
  });
  test('DELETE removes the component', async () => {
    const victim = COMPONENTS[3];
    assert.equal((await asAdmin('DELETE', `/${victim.slug}`)).status, 204);
    assert.equal((await asAdmin('GET', `/${victim.slug}`)).status, 404);
  });
  test('changes are saved to components.json', async () => {
    const saved = JSON.parse(await fs.readFile(env.server.components.location, 'utf8')) as Component[];
    assert.equal(saved.find((c) => c.slug === target.slug)?.name, 'renamed grid');
    assert.equal(saved.length, COMPONENTS.length); // one created, one deleted
  });
});
