// MCP server tests: the pure tool handlers, plus an in-memory client <-> server round trip.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createServer } from '../../mcp/server';
import {
  compareComponents,
  findComponent,
  getComponent,
  getComponentReviews,
  listPublishers,
  MAX_LIMIT,
  searchComponents,
  suggestComponents,
} from '../../mcp/tools';
import { COMPONENTS } from '../../src/data/components';

const FIRST = COMPONENTS[0];

describe('searchComponents', () => {
  test('defaults to the 10 most downloaded components', () => {
    const { total, results } = searchComponents({});
    assert.equal(total, COMPONENTS.length);
    assert.equal(results.length, 10);
    const downloads = results.map((r) => r.downloads);
    assert.deepEqual(
      downloads,
      downloads.toSorted((a, b) => b - a),
    );
  });

  test('applies every filter', () => {
    const { results } = searchComponents({
      type: 'Widget',
      license: 'Free',
      platformVersion: '11.5',
      limit: MAX_LIMIT,
    });
    assert.ok(results.length > 0);
    for (const r of results) {
      const c = findComponent(r.id);
      assert.equal(c?.type, 'Widget');
      assert.equal(c?.license, 'Free');
      assert.ok(c?.compatible.includes('11.5'));
    }
  });

  test('matches every word of the query', () => {
    const { results } = searchComponents({ query: 'pdf generator' });
    assert.ok(results.some((r) => r.name === 'PDF Generator'));
  });

  test('minRating excludes unrated and lower-rated components', () => {
    const { results } = searchComponents({ minRating: 4.5, limit: MAX_LIMIT });
    assert.ok(results.every((r) => r.rating >= 4.5 && r.ratingCount > 0));
  });

  test('sorts by name and caps the limit', () => {
    const { results } = searchComponents({ sort: 'name', limit: 1000 });
    assert.equal(results.length, MAX_LIMIT);
    const names = results.map((r) => r.name);
    assert.deepEqual(
      names,
      names.toSorted((a, b) => a.localeCompare(b)),
    );
  });
});

describe('component lookup', () => {
  test('finds by slug, id and case-insensitive name', () => {
    assert.equal(findComponent(FIRST.slug), FIRST);
    assert.equal(findComponent(String(FIRST.id)), FIRST);
    assert.equal(findComponent(FIRST.name.toUpperCase()), FIRST);
  });

  test('returns full details without UI-only fields', () => {
    const result = getComponent(FIRST.slug);
    assert.ok(result.ok);
    assert.equal(result.data.name, FIRST.name);
    assert.ok(result.data.latestReleases.length <= 3);
    assert.equal('color' in result.data, false);
  });

  test('suggests close matches when nothing matches', () => {
    const result = getComponent('pdf generater');
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /Did you mean: .*PDF Generator/);
    assert.equal(suggestComponents('zzzz-nothing').length, 0);
  });

  test('reviews include a star breakdown that adds up', () => {
    const withReviews = COMPONENTS.find((c) => c.reviews.length > 0);
    assert.ok(withReviews);
    const result = getComponentReviews(withReviews.slug);
    assert.ok(result.ok);
    const sum = Object.values(result.data.starBreakdown).reduce((a, b) => a + b, 0);
    assert.equal(sum, withReviews.reviews.length);
  });
});

describe('publishers and compare', () => {
  test('filters publishers by country and verification', () => {
    const german = listPublishers({ verified: true, country: 'germany' });
    assert.deepEqual(
      german.map((p) => p.name),
      ['BlueOrbit Software'],
    );
    assert.ok(german[0].componentCount > 0);
  });

  test('compares 2 to 4 components and rejects other counts', () => {
    const result = compareComponents([COMPONENTS[0].slug, COMPONENTS[1].slug]);
    assert.ok(result.ok);
    assert.equal(result.data.length, 2);
    assert.equal(compareComponents([FIRST.slug]).ok, false);
    assert.equal(compareComponents([FIRST.slug, 'no-such-thing']).ok, false);
  });
});

describe('MCP server over an in-memory transport', () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  before(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    await client.connect(clientTransport);
  });
  after(() => client.close());

  test('lists every tool', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).toSorted(), [
      'compare_components',
      'get_component',
      'get_component_releases',
      'get_component_reviews',
      'get_studio_releases',
      'get_studio_summary',
      'list_publishers',
      'list_taxonomy',
      'search_components',
    ]);
  });

  test('calls a tool and returns JSON text', async () => {
    const result = await client.callTool({ name: 'get_component', arguments: { component: FIRST.slug } });
    const [content] = result.content as { type: string; text: string }[];
    assert.equal(JSON.parse(content.text).slug, FIRST.slug);
  });

  test('flags lookup failures with isError', async () => {
    const result = await client.callTool({ name: 'get_component', arguments: { component: 'does-not-exist' } });
    assert.equal(result.isError, true);
  });

  test('reads the component resource', async () => {
    const { contents } = await client.readResource({ uri: `marketplace://component/${FIRST.slug}` });
    const [content] = contents;
    assert.ok('text' in content);
    assert.equal(JSON.parse(content.text).name, FIRST.name);
  });
});
