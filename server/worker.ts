// Cloudflare Worker entry. Static assets (the Vite build in dist/) are served by the
// platform; only /api/* reaches this code (see run_worker_first in wrangler.jsonc).
import type { StudioRelease } from '../shared/studio';
import { createApp } from './app';
import { ReleaseStore, type Persistence } from './store';

/** The subset of the Workers KV binding this file uses. */
interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  STUDIO_KV: KVNamespace;
}

const KEY = 'releases';

class KvPersistence implements Persistence {
  readonly location = `kv:${KEY}`;
  constructor(private readonly kv: KVNamespace) {}

  async load(): Promise<StudioRelease[] | null> {
    const value = await this.kv.get(KEY, 'json');
    if (value === null) return null;
    if (!Array.isArray(value)) throw new Error(`KV key "${KEY}" must contain an array`);
    return value as StudioRelease[];
  }

  async save(data: StudioRelease[]): Promise<void> {
    await this.kv.put(KEY, JSON.stringify(data));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Isolates are short-lived and may run in parallel, so load fresh state per request.
    // The API is same-origin with the app, so no CORS origins are needed.
    const store = await ReleaseStore.load(new KvPersistence(env.STUDIO_KV));
    return createApp(store, { corsOrigins: [] }).fetch(request);
  },
};
