// Cloudflare Worker entry. Static assets (the Vite build in dist/) are served by the
// platform; only /api/* and /mcp reach this code (see run_worker_first in wrangler.jsonc).
import type { Component } from '../src/types';
import type { ApiErrorBody, StudioRelease } from '../shared/studio';
import { createApp } from './app';
import { accountsFromEnv, type AccountEnv } from './auth';
import { ComponentStore } from './component-store';
import type { Persistence } from './persisted-list';
import { ReleaseStore } from './store';

/** The subset of the Workers KV binding this file uses. */
interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

interface Env extends AccountEnv {
  STUDIO_KV: KVNamespace;
  /** Session signing key, set with `npx wrangler secret put AUTH_SECRET`. */
  AUTH_SECRET?: string;
}

class KvPersistence<T> implements Persistence<T> {
  readonly location: string;
  constructor(
    private readonly kv: KVNamespace,
    private readonly key: string,
  ) {
    this.location = `kv:${key}`;
  }

  async load(): Promise<T[] | null> {
    const value = await this.kv.get(this.key, 'json');
    if (value === null) return null;
    if (!Array.isArray(value)) throw new Error(`KV key "${this.key}" must contain an array`);
    return value as T[];
  }

  async save(data: T[]): Promise<void> {
    await this.kv.put(this.key, JSON.stringify(data));
  }
}

const missingSecretResponse = () =>
  Response.json(
    {
      error: {
        code: 'auth_not_configured',
        message: 'AUTH_SECRET is not set. Run `npx wrangler secret put AUTH_SECRET` and deploy again.',
      },
    } satisfies ApiErrorBody,
    { status: 500 },
  );

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.AUTH_SECRET) return missingSecretResponse();
    // Isolates are short-lived and may run in parallel, so load fresh state per request.
    // The API is same-origin with the app, so no CORS origins are needed.
    const [releases, components] = await Promise.all([
      ReleaseStore.load(new KvPersistence<StudioRelease>(env.STUDIO_KV, 'releases')),
      ComponentStore.load(new KvPersistence<Component>(env.STUDIO_KV, 'components')),
    ]);
    const auth = { accounts: accountsFromEnv(env), secret: env.AUTH_SECRET };
    return createApp({ releases, components }, { corsOrigins: [], auth }).fetch(request);
  },
};
