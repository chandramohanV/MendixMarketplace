// MCP server for Claude Desktop: exposes the marketplace catalog and the Studio Releases API over stdio.
// stdout carries the MCP protocol, so log only with console.error.
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import { COMPONENTS } from '../src/data/components';
import { compareInput, componentRef, publishersInput, reviewsInput, searchInput, studioReleasesInput } from './schemas';
import { getStudioReleases, getStudioSummary } from './studio';
import {
  compareComponents,
  getComponent,
  getComponentReleases,
  getComponentReviews,
  listPublishers,
  listTaxonomy,
  searchComponents,
} from './tools';
import type { ToolResult } from './result';

const JSON_MIME = 'application/json';
const toJson = (data: unknown) => JSON.stringify(data, null, 2);
const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: toJson(data) }] });
const respond = (result: ToolResult<unknown>) =>
  result.ok ? text(result.data) : { ...text({ error: result.error }), isError: true };
const resource = (uri: URL, data: unknown) => ({
  contents: [{ uri: uri.href, mimeType: JSON_MIME, text: toJson(data) }],
});

/** Catalog tools read local data; Studio tools call an external API. */
const CATALOG = { readOnlyHint: true, openWorldHint: false } as const;
const EXTERNAL = { readOnlyHint: true, openWorldHint: true } as const;

function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'search_components',
    {
      title: 'Search components',
      description:
        'Search the component marketplace catalog. Every word of the query must match the name, description, publisher, category, type or tags. Combine with filters. Returns compact summaries; call get_component for full details.',
      inputSchema: searchInput,
      annotations: CATALOG,
    },
    async (input) => text(searchComponents(input)),
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get component details',
      description:
        'Full details for one component: description, features, tags, compatibility, license, publisher, latest releases and a review summary. Suggests close matches if not found.',
      inputSchema: { component: componentRef },
      annotations: CATALOG,
    },
    async ({ component }) => respond(getComponent(component)),
  );

  server.registerTool(
    'get_component_reviews',
    {
      title: 'Get component reviews',
      description: 'User reviews for a component (most helpful first) with the average rating and a star breakdown.',
      inputSchema: reviewsInput,
      annotations: CATALOG,
    },
    async ({ component, limit }) => respond(getComponentReviews(component, limit)),
  );

  server.registerTool(
    'get_component_releases',
    {
      title: 'Get component release history',
      description: 'Release history of a component: versions, dates, minimum platform version and release notes.',
      inputSchema: { component: componentRef },
      annotations: CATALOG,
    },
    async ({ component }) => respond(getComponentReleases(component)),
  );

  server.registerTool(
    'list_publishers',
    {
      title: 'List publishers',
      description: 'Marketplace publishers with verification status, country, component count and total downloads.',
      inputSchema: publishersInput,
      annotations: CATALOG,
    },
    async (input) => text(listPublishers(input)),
  );

  server.registerTool(
    'list_taxonomy',
    {
      title: 'List filter values',
      description:
        'Valid values for component types, categories, industries, support levels (with meaning), licenses, platform versions and publishers.',
      inputSchema: {},
      annotations: CATALOG,
    },
    async () => text(listTaxonomy()),
  );

  server.registerTool(
    'compare_components',
    {
      title: 'Compare components',
      description:
        'Side-by-side comparison of 2 to 4 components (rating, downloads, license, price, compatibility, features).',
      inputSchema: compareInput,
      annotations: CATALOG,
    },
    async ({ components }) => respond(compareComponents(components)),
  );
}

function registerStudioTools(server: McpServer): void {
  server.registerTool(
    'get_studio_summary',
    {
      title: 'Studio release summary',
      description:
        'Studio (the platform IDE) release overview: latest release, recommended LTS and supported version lines.',
      inputSchema: {},
      annotations: EXTERNAL,
    },
    async () => respond(await getStudioSummary()),
  );

  server.registerTool(
    'get_studio_releases',
    {
      title: 'Studio releases',
      description:
        'Studio (the platform IDE) releases. Pass a version for that release with its notes, or filter the list by search text (q), version line or release type.',
      inputSchema: studioReleasesInput,
      annotations: EXTERNAL,
    },
    async (input) => respond(await getStudioReleases(input)),
  );
}

function registerResources(server: McpServer): void {
  server.registerResource(
    'taxonomy',
    'marketplace://taxonomy',
    { title: 'Marketplace taxonomy', description: 'Valid filter values', mimeType: JSON_MIME },
    async (uri) => resource(uri, listTaxonomy()),
  );

  const listComponents = async () => ({
    resources: COMPONENTS.map((c) => ({ uri: `marketplace://component/${c.slug}`, name: c.name, mimeType: JSON_MIME })),
  });
  server.registerResource(
    'component',
    new ResourceTemplate('marketplace://component/{slug}', { list: listComponents }),
    { title: 'Component', description: 'Full details of one component', mimeType: JSON_MIME },
    async (uri, { slug }) => {
      const result = getComponent(String(slug));
      return resource(uri, result.ok ? result.data : { error: result.error });
    },
  );
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'component-marketplace', version: '1.0.0' });
  registerCatalogTools(server);
  registerStudioTools(server);
  registerResources(server);
  return server;
}

// Start on stdio only when run directly; tests import createServer without starting it.
const isEntryPoint = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isEntryPoint) {
  await createServer().connect(new StdioServerTransport());
  console.error(`[mcp] component-marketplace server running on stdio (${COMPONENTS.length} components)`);
}
