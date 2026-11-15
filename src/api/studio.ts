// Typed client for the Studio Releases API. Every response is validated with the shared Zod schemas.
import type { z } from 'zod';
import {
  ApiErrorSchema, ReleaseListSchema, StudioReleaseSchema, SummarySchema,
  type CreateReleaseInput, type FieldError, type ListQuery, type PatchReleaseInput,
  type ReleaseList, type StudioRelease, type StudioSummary, type UpdateReleaseInput,
} from '../../shared/studio';

const BASE = '/api/studio';

/** Any failure talking to the API: HTTP errors carry the server's code/details; network errors use status 0. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

async function request<S extends z.ZodType>(path: string, schema: S | null, init: RequestInit = {}): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new ApiError(0, 'network_error', 'Could not reach the Studio API. Check that it is running.');
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    throw new ApiError(res.status, 'http_error', `The Studio API returned ${res.status}.`);
  }
  if (!schema) return undefined as z.output<S>;
  const data = schema.safeParse(await res.json());
  if (!data.success) throw new ApiError(res.status, 'bad_response', 'The Studio API returned an unexpected response.');
  return data.data;
}

const json = (body: unknown) => JSON.stringify(body);
const enc = encodeURIComponent;

export function listReleases(query: ListQuery, signal?: AbortSignal): Promise<ReleaseList> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  return request(`/releases?${params}`, ReleaseListSchema, { signal });
}
export const getRelease = (version: string, signal?: AbortSignal): Promise<StudioRelease> =>
  request(`/releases/${enc(version)}`, StudioReleaseSchema, { signal });
export const getSummary = (signal?: AbortSignal): Promise<StudioSummary> =>
  request('/summary', SummarySchema, { signal });
export const createRelease = (input: CreateReleaseInput): Promise<StudioRelease> =>
  request('/releases', StudioReleaseSchema, { method: 'POST', body: json(input) });
export const updateRelease = (version: string, input: UpdateReleaseInput): Promise<StudioRelease> =>
  request(`/releases/${enc(version)}`, StudioReleaseSchema, { method: 'PUT', body: json(input) });
export const patchRelease = (version: string, input: PatchReleaseInput): Promise<StudioRelease> =>
  request(`/releases/${enc(version)}`, StudioReleaseSchema, { method: 'PATCH', body: json(input) });
export async function deleteRelease(version: string): Promise<void> {
  await request(`/releases/${enc(version)}`, null, { method: 'DELETE' });
}
