// Shared setup for the API suites: a real server on a random port with a throwaway data directory.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer, type RunningServer } from '../../server/server';
import { DEFAULT_ACCOUNTS } from '../../server/auth';
import type { Role } from '../../shared/auth';

export interface TestServer {
  server: RunningServer;
  /** Server origin, e.g. http://127.0.0.1:51234 */
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'marketplace-api-'));
  const server = await startServer({ port: 0, dataDir: dir });
  return {
    server,
    url: server.url,
    async close() {
      await server.close();
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/** Signs in with a default account and returns the `Cookie` header value for later requests. */
export async function signIn(url: string, role: Role): Promise<string> {
  const account = DEFAULT_ACCOUNTS.find((a) => a.role === role);
  if (!account) throw new Error(`No default account with role ${role}`);
  const res = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: account.username, password: account.password }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (res.status !== 200 || !setCookie) throw new Error(`Sign-in as ${role} failed with ${res.status}`);
  return setCookie.split(';')[0];
}

export interface JsonResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

/** Sends a request (JSON body optional) and parses the JSON response; an empty body becomes null. */
export async function requestJson<T = unknown>(
  url: string,
  method: string,
  { body, cookie }: { body?: unknown; cookie?: string } = {},
): Promise<JsonResponse<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: (text ? JSON.parse(text) : null) as T };
}
