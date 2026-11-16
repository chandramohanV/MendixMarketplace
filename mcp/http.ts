// Remote entry point (claude.ai custom connector): MCP over Streamable HTTP, served by the Cloudflare Worker.
// Stateless: every request gets a fresh server and transport, which suits short-lived Worker isolates.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker-provider.js';
import { createServer } from './server';
import type { StudioClient } from './studio';

export const MCP_PATH = '/mcp';

export async function handleMcpRequest(request: Request, studio: StudioClient): Promise<Response> {
  // Workers forbid eval, so use the eval-free JSON Schema validator instead of the default (Ajv).
  const server = createServer(studio, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
