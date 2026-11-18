// Starts the API. Used by the CLI entry (index.ts) and by the test suites.
import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { DEFAULT_ACCOUNTS, type Account } from './auth';
import { openFileStores, type FileStores } from './file-persistence';

export const DEFAULT_DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

export interface StartOptions {
  port?: number; // 0 = random free port
  hostname?: string;
  dataDir?: string;
  corsOrigins?: string[];
  accounts?: readonly Account[];
  /** Session signing key. Defaults to a random key, so restarting the server signs everybody out. */
  authSecret?: string;
}

export interface RunningServer extends FileStores {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export async function startServer(opts: StartOptions = {}): Promise<RunningServer> {
  const stores = await openFileStores(opts.dataDir ?? DEFAULT_DATA_DIR);
  const app = createApp(stores, {
    corsOrigins: opts.corsOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
    auth: {
      accounts: opts.accounts ?? DEFAULT_ACCOUNTS,
      secret: opts.authSecret ?? randomBytes(32).toString('hex'),
    },
  });
  const hostname = opts.hostname ?? '127.0.0.1';
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: opts.port ?? 5174, hostname }, (info) => {
      resolve({
        url: `http://${hostname}:${info.port}`,
        port: info.port,
        ...stores,
        close: () => new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done()))),
      });
    });
  });
}
