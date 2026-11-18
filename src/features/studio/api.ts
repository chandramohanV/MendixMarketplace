// Typed client for the Studio Releases API. Every response is validated with the shared Zod schemas.
import {
  ReleaseListSchema,
  StudioReleaseSchema,
  SummarySchema,
  type CreateReleaseInput,
  type ListQuery,
  type ReleaseList,
  type StudioRelease,
  type StudioSummary,
  type UpdateReleaseInput,
} from '../../../shared/studio';
import { createApiRequest, toJsonBody as json } from '../../lib/api';

export { ApiError, isAbortError } from '../../lib/api';

const request = createApiRequest('/api/studio', 'Studio API');
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
export async function deleteRelease(version: string): Promise<void> {
  await request(`/releases/${enc(version)}`, null, { method: 'DELETE' });
}
