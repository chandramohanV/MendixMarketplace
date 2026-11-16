// Read-only client for the Studio Releases API (the Hono app in server/app.ts).
// The transport is injected: over HTTP for Claude Desktop, in-process inside the Cloudflare Worker.
import type { ListQuery } from '../shared/studio';
import { fail, ok, type ToolResult } from './result';

/** Sends a GET for a path under /api/studio (e.g. "/summary?x=1"). */
export type StudioFetcher = (path: string) => Promise<Response>;

export type StudioReleasesInput = Partial<ListQuery> & { version?: string };

export interface StudioClient {
  summary(): Promise<ToolResult<unknown>>;
  /** One release (with notes) when a version is given, otherwise a filtered page of releases. */
  releases(input: StudioReleasesInput): Promise<ToolResult<unknown>>;
}

export const DEFAULT_STUDIO_API_URL = 'https://component-marketplace.component-marketplace.workers.dev/api/studio';
const TIMEOUT_MS = 8000;

function errorMessage(body: unknown, status: number): string {
  const hasError = typeof body === 'object' && body !== null && 'error' in body;
  return hasError ? JSON.stringify(body.error) : `HTTP ${status}`;
}

function withQuery(path: string, query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function createStudioClient(fetcher: StudioFetcher, describe = 'the Studio API'): StudioClient {
  async function get(path: string): Promise<ToolResult<unknown>> {
    let res: Response;
    try {
      res = await fetcher(path);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return fail(`${describe} is unreachable (${reason}).`);
    }
    const body: unknown = await res.json().catch(() => null);
    return res.ok ? ok(body) : fail(`Studio API error for ${path}: ${errorMessage(body, res.status)}`);
  }

  return {
    summary: () => get('/summary'),
    releases: ({ version, ...query }) =>
      version ? get(`/releases/${encodeURIComponent(version)}`) : get(withQuery('/releases', query)),
  };
}

/** A client that calls the API over HTTP at baseUrl (default: the deployed Worker). */
export function createHttpStudioClient(baseUrl = DEFAULT_STUDIO_API_URL): StudioClient {
  const base = baseUrl.replace(/\/+$/, '');
  return createStudioClient(
    (path) => fetch(base + path, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
    `The Studio API at ${base} (set STUDIO_API_URL, or run "npm run dev:api" for a local one)`,
  );
}
