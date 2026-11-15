// Starts the API. Used by the CLI entry (index.ts) and by the test suites.
import { serve } from '@hono/node-server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { ReleaseStore } from './store';

export const DEFAULT_DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

export interface StartOptions {
  port?: number; // 0 = random free port
  hostname?: string;
  dataDir?: string;
  corsOrigins?: string[];
}

export interface RunningServer {
  url: string;
  port: number;
  store: ReleaseStore;
  close: () => Promise<void>;
}

export async function startServer(opts: StartOptions = {}): Promise<RunningServer> {
  const store = await ReleaseStore.open(opts.dataDir ?? DEFAULT_DATA_DIR);
  const app = createApp(store, { corsOrigins: opts.corsOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'] });
  const hostname = opts.hostname ?? '127.0.0.1';
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: opts.port ?? 5174, hostname }, (info) => {
      resolve({
        url: `http://${hostname}:${info.port}`,
        port: info.port,
        store,
        close: () => new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done()))),
      });
    });
  });
}
