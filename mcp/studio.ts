// Read-only client for the Studio Releases API (the Hono app in server/app.ts).
import type { ListQuery } from '../shared/studio';
import { fail, ok, type ToolResult } from './result';

export const DEFAULT_STUDIO_API_URL = 'https://component-marketplace.component-marketplace.workers.dev/api/studio';
const TIMEOUT_MS = 8000;

export const studioBaseUrl = (): string => (process.env.STUDIO_API_URL || DEFAULT_STUDIO_API_URL).replace(/\/+$/, '');

function errorMessage(body: unknown, status: number): string {
  const hasError = typeof body === 'object' && body !== null && 'error' in body;
  return hasError ? JSON.stringify(body.error) : `HTTP ${status}`;
}

async function get(path: string, query: Record<string, unknown> = {}): Promise<ToolResult<unknown>> {
  const url = new URL(studioBaseUrl() + path);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return fail(
      `The Studio API at ${studioBaseUrl()} is unreachable (${reason}). Check STUDIO_API_URL, or start it locally with "npm run dev:api".`,
    );
  }

  const body: unknown = await res.json().catch(() => null);
  return res.ok ? ok(body) : fail(`Studio API error for ${url.pathname}: ${errorMessage(body, res.status)}`);
}

export const getStudioSummary = () => get('/summary');

export type StudioReleasesInput = Partial<ListQuery> & { version?: string };

/** One release (with notes) when a version is given, otherwise a filtered page of releases. */
export function getStudioReleases({ version, ...query }: StudioReleasesInput) {
  return version ? get(`/releases/${encodeURIComponent(version)}`) : get('/releases', query);
}
