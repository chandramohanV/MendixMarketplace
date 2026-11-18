// CLI entry: `npm run dev:api`. Optional env vars: PORT, DATA_DIR, CORS_ORIGIN, AUTH_SECRET,
// USER_PASSWORD and ADMIN_PASSWORD.
import { accountsFromEnv } from './auth';
import { DEFAULT_DATA_DIR, startServer } from './server';

const port = Number(process.env.PORT ?? 5174);
const dataDir = process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim());

const server = await startServer({
  port,
  dataDir,
  corsOrigins,
  accounts: accountsFromEnv(process.env),
  authSecret: process.env.AUTH_SECRET,
});
console.log(`[api] API listening on ${server.url}/api (data: ${server.releases.file}, ${server.components.location})`);

const shutdown = () => {
  server.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
