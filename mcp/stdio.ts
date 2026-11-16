// Claude Desktop entry point: runs the MCP server over stdio.
// stdout carries the MCP protocol, so log only with console.error.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';
import { createHttpStudioClient } from './studio';

const studio = createHttpStudioClient(process.env.STUDIO_API_URL || undefined);
await createServer(studio).connect(new StdioServerTransport());
console.error('[mcp] component-marketplace server running on stdio');
