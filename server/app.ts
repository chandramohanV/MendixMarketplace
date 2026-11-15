// HTTP layer: routing, validation and the JSON error format.
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import {
  CreateReleaseSchema,
  ListQuerySchema,
  PatchReleaseSchema,
  UpdateReleaseSchema,
  toFieldErrors,
  type ApiErrorBody,
  type FieldError,
} from '../shared/studio';
import { HttpError, type ReleaseStore } from './store';

export interface AppOptions {
  /** Origins allowed to call the API cross-origin (the Vite dev server). */
  corsOrigins: string[];
}

function errorResponse(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: FieldError[],
) {
  const body: ApiErrorBody = { error: { code, message, ...(details?.length ? { details } : {}) } };
  return c.json(body, status);
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be valid JSON.');
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown, status: 400 | 422 = 422): z.output<S> {
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

export function createApp(store: ReleaseStore, { corsOrigins }: AppOptions): Hono {
  const app = new Hono();

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (corsOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      exposeHeaders: ['Location'],
    }),
  );

  const api = new Hono();
  api.get('/health', (c) => c.json({ ok: true }));
  api.get('/summary', (c) => c.json(store.summary()));

  api.get('/releases', (c) => c.json(store.list(parse(ListQuerySchema, c.req.query(), 400))));
  api.get('/releases/:version', (c) => c.json(store.get(c.req.param('version'))));

  api.post('/releases', async (c) => {
    const created = await store.create(parse(CreateReleaseSchema, await readJson(c)));
    c.header('Location', `/api/studio/releases/${created.version}`);
    return c.json(created, 201);
  });
  api.put('/releases/:version', async (c) =>
    c.json(await store.update(c.req.param('version'), parse(UpdateReleaseSchema, await readJson(c)))),
  );
  api.patch('/releases/:version', async (c) =>
    c.json(await store.patch(c.req.param('version'), parse(PatchReleaseSchema, await readJson(c)))),
  );
  api.delete('/releases/:version', async (c) => {
    await store.remove(c.req.param('version'));
    return c.body(null, 204);
  });

  app.route('/api/studio', api);

  app.notFound((c) => errorResponse(c, 404, 'not_found', `No route for ${c.req.method} ${c.req.path}.`));
  app.onError((err, c) => {
    if (err instanceof HttpError) return errorResponse(c, err.status, err.code, err.message, err.details);
    console.error('[api] unexpected error:', err);
    return errorResponse(c, 500, 'internal', 'Internal server error.');
  });

  return app;
}
