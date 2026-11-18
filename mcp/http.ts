// Remote entry point (claude.ai custom connector): MCP over Streamable HTTP, served by the Cloudflare Worker.
// Stateless: every request gets a fresh server and transport, which suits short-lived Worker isolates.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker-provider.js';
import { createServer } from './server';
import type { StudioClient } from './studio';

export const MCP_PATH = '/mcp';

const JSON_MIME = 'application/json';
const EVENT_STREAM_MIME = 'text/event-stream';
const MCP_ACCEPT = `${JSON_MIME}, ${EVENT_STREAM_MIME}`;

export const ENDPOINT_INFO = {
  name: 'component-marketplace',
  description: 'Read-only MCP server for the component catalog and Studio releases (Streamable HTTP).',
  usage:
    'Add this URL as a custom connector in claude.ai, or as an "http" server in .mcp.json. Send JSON-RPC via POST.',
};

export async function handleMcpRequest(request: Request, studio: StudioClient): Promise<Response> {
  if (isBrowserVisit(request)) return Response.json(ENDPOINT_INFO);

  // Workers forbid eval, so use the eval-free JSON Schema validator instead of the default (Ajv).
  const server = createServer(studio, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(withMcpAccept(request));
}

// A GET without text/event-stream is a person opening the URL, not an MCP client opening an SSE stream.
function isBrowserVisit(request: Request): boolean {
  return request.method === 'GET' && !acceptsEventStream(request);
}

function acceptsEventStream(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes(EVENT_STREAM_MIME);
}

// The SDK rejects a POST unless Accept lists both JSON and SSE, even though this endpoint only ever answers
// with JSON (enableJsonResponse). Filling in the header lets JSON-only clients and plain curl work too.
function withMcpAccept(request: Request): Request {
  if (request.method !== 'POST') return request;
  const headers = new Headers(request.headers);
  headers.set('accept', MCP_ACCEPT);
  return new Request(request, { headers });
}
