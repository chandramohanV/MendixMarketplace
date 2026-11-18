// MCP server tests: the pure tool handlers, the Studio client, an in-memory client <-> server round trip,
// and the remote /mcp endpoint over real HTTP.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { ENDPOINT_INFO, MCP_PATH } from '../../mcp/http';
import { ok } from '../../mcp/result';
import { createServer } from '../../mcp/server';
import { createStudioClient, type StudioClient } from '../../mcp/studio';
import { startServer, type RunningServer } from '../../server/server';
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

const textOf = (result: Awaited<ReturnType<Client['callTool']>>): string =>
  (result.content as { type: string; text: string }[])[0].text;

describe('Studio client', () => {
  test('builds paths and query strings, skipping empty values', async () => {
    const paths: string[] = [];
    const studio = createStudioClient(async (p) => {
      paths.push(p);
      return Response.json({ ok: true });
    });
    await studio.summary();
    await studio.releases({ line: '11.0', q: '', pageSize: 2 });
    await studio.releases({ version: '11.2.0' });
    assert.deepEqual(paths, ['/summary', '/releases?line=11.0&pageSize=2', '/releases/11.2.0']);
  });

  test('turns API errors and network failures into messages', async () => {
    const apiError = createStudioClient(async () =>
      Response.json({ error: { code: 'not_found', message: 'nope' } }, { status: 404 }),
    );
    const result = await apiError.releases({ version: '1.0.0' });
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.error, /not_found/);

    const down = createStudioClient(async () => {
      throw new Error('ECONNREFUSED');
    }, 'Test API');
    const failure = await down.summary();
    assert.match(failure.ok ? '' : failure.error, /Test API is unreachable \(ECONNREFUSED\)/);
  });
});

const FAKE_STUDIO: StudioClient = {
  summary: async () => ok({ latest: { version: '9.9.9' } }),
  releases: async () => ok({ items: [] }),
};

describe('MCP server over an in-memory transport', () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  before(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer(FAKE_STUDIO).connect(serverTransport);
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
    assert.equal(JSON.parse(textOf(result)).slug, FIRST.slug);
  });

  test('Studio tools use the injected client', async () => {
    const result = await client.callTool({ name: 'get_studio_summary', arguments: {} });
    assert.equal(JSON.parse(textOf(result)).latest.version, '9.9.9');
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

describe('remote MCP endpoint over HTTP', () => {
  let server: RunningServer;
  let dataDir: string;
  const client = new Client({ name: 'http-test-client', version: '1.0.0' });

  before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-http-'));
    server = await startServer({ port: 0, dataDir });
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url + MCP_PATH)));
  });
  after(async () => {
    await client.close();
    await server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  test('serves catalog tools', async () => {
    const result = await client.callTool({ name: 'search_components', arguments: { query: 'pdf', limit: 1 } });
    assert.equal(JSON.parse(textOf(result)).results[0].name, 'PDF Generator');
  });

  test('Studio tools read the same server in-process', async () => {
    const [summary, direct] = await Promise.all([
      client.callTool({ name: 'get_studio_summary', arguments: {} }),
      fetch(`${server.url}/api/studio/summary`).then((r) => r.json()),
    ]);
    assert.deepEqual(JSON.parse(textOf(summary)), direct);
  });

  test('describes itself to a browser visit instead of rejecting it', async () => {
    const response = await fetch(server.url + MCP_PATH, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), ENDPOINT_INFO);
  });

  test('answers a POST from a client that only accepts JSON', async () => {
    const response = await fetch(server.url + MCP_PATH, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.result.tools.some((tool: { name: string }) => tool.name === 'search_components'));
  });
});
