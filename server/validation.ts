// Request parsing shared by every route: JSON bodies and query strings validated with the shared Zod schemas.
import type { Context } from 'hono';
import type { z } from 'zod';
import { toFieldErrors } from '../shared/studio';
import { HttpError } from './http-error';

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be valid JSON.');
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown, status: 400 | 422 = 422): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      status,
      status === 400 ? 'bad_query' : 'validation_failed',
      status === 400 ? 'Invalid query parameters.' : 'The request body is invalid.',
      toFieldErrors(result.error),
    );
  }
  return result.data;
}

export const parseBody = async <S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> =>
  parse(schema, await readJson(c));
