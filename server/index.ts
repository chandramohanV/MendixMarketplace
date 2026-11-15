// CLI entry: `npm run dev:api` (PORT, DATA_DIR and CORS_ORIGIN env vars are optional).
import { DEFAULT_DATA_DIR, startServer } from './server';

const port = Number(process.env.PORT ?? 5174);
const dataDir = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim());

const server = await startServer({ port, dataDir, corsOrigins });
console.log(`[api] Studio API listening on ${server.url}/api/studio (data: ${server.store.file})`);

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
