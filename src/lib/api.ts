// Typed fetch for the app's own API. Every response is validated with a shared Zod schema.
import type { z } from 'zod';
import { ApiErrorSchema, type FieldError } from '../../shared/studio';

/** Any failure talking to the API: HTTP errors carry the server's code/details; network errors use status 0. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export const toJsonBody = (body: unknown): string => JSON.stringify(body);

/**
 * Returns a `request(path, schema, init)` function for one API area. `serviceName` appears in error
 * messages (e.g. "Could not reach the Studio API"). A null schema means the response has no body.
 */
export function createApiRequest(base: string, serviceName: string) {
  return async function request<S extends z.ZodType>(
    path: string,
    schema: S | null,
    init: RequestInit = {},
  ): Promise<z.output<S>> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        ...init,
        headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
      });
    } catch (e) {
      if (isAbortError(e)) throw e;
      throw new ApiError(0, 'network_error', `Could not reach the ${serviceName}. Check that it is running.`);
    }
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const parsed = ApiErrorSchema.safeParse(body);
      if (parsed.success)
        throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
      throw new ApiError(res.status, 'http_error', `The ${serviceName} returned ${res.status}.`);
    }
    if (!schema) return undefined as z.output<S>;
    const data = schema.safeParse(await res.json());
    if (!data.success)
      throw new ApiError(res.status, 'bad_response', `The ${serviceName} returned an unexpected response.`);
    return data.data;
  };
}
