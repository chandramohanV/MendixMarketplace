// HTTP layer: routing, sign-in checks, validation and the JSON error format.
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ComponentInputSchema, type ComponentList } from '../shared/components';
import {
  CreateReleaseSchema,
  ListQuerySchema,
  PatchReleaseSchema,
  UpdateReleaseSchema,
  type ApiErrorBody,
  type FieldError,
} from '../shared/studio';
import { handleMcpRequest, MCP_PATH } from '../mcp/http';
import { createStudioClient } from '../mcp/studio';
import { createAuthRoutes, requireAdmin, requireSession, type AuthOptions } from './auth';
import type { ComponentStore } from './component-store';
import { HttpError } from './http-error';
import type { ReleaseStore } from './store';
import { parse, parseBody } from './validation';

export interface AppStores {
  releases: ReleaseStore;
  components: ComponentStore;
}

export interface AppOptions {
  /** Origins allowed to call the API cross-origin (the Vite dev server). */
  corsOrigins: string[];
  auth: AuthOptions;
}

const STUDIO_PATH = '/api/studio/*';
const COMPONENT_PATHS = ['/api/components', '/api/components/*'];
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

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

function createStudioRoutes(store: ReleaseStore): Hono {
  const api = new Hono();
  api.get('/summary', (c) => c.json(store.summary()));

  api.get('/releases', (c) => c.json(store.list(parse(ListQuerySchema, c.req.query(), 400))));
  api.get('/releases/:version', (c) => c.json(store.get(c.req.param('version'))));

  api.post('/releases', async (c) => {
    const created = await store.create(await parseBody(c, CreateReleaseSchema));
    c.header('Location', `/api/studio/releases/${created.version}`);
    return c.json(created, 201);
  });
  api.put('/releases/:version', async (c) =>
    c.json(await store.update(c.req.param('version'), await parseBody(c, UpdateReleaseSchema))),
  );
  api.patch('/releases/:version', async (c) =>
    c.json(await store.patch(c.req.param('version'), await parseBody(c, PatchReleaseSchema))),
  );
  api.delete('/releases/:version', async (c) => {
    await store.remove(c.req.param('version'));
    return c.body(null, 204);
  });
  return api;
}

function createComponentRoutes(store: ComponentStore): Hono {
  const api = new Hono();
  api.get('/', (c) => c.json({ items: store.list() } satisfies ComponentList));
  api.get('/:slug', (c) => c.json(store.get(c.req.param('slug'))));

  api.post('/', async (c) => {
    const created = await store.create(await parseBody(c, ComponentInputSchema));
    c.header('Location', `/api/components/${created.slug}`);
    return c.json(created, 201);
  });
  api.put('/:slug', async (c) =>
    c.json(await store.update(c.req.param('slug'), await parseBody(c, ComponentInputSchema))),
  );
  api.delete('/:slug', async (c) => {
    await store.remove(c.req.param('slug'));
    return c.body(null, 204);
  });
  return api;
}

export function createApp(stores: AppStores, { corsOrigins, auth }: AppOptions): Hono {
  const app = new Hono();

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (corsOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      exposeHeaders: ['Location'],
      credentials: true,
    }),
  );

  app.get('/api/studio/health', (c) => c.json({ ok: true }));
  app.route('/api/auth', createAuthRoutes(auth));

  // Access rules. Studio reads stay public: the Claude Desktop MCP server reads them over HTTP without a
  // session, and the same data is public through /mcp anyway. The catalog needs a session; every write
  // needs an admin.
  for (const path of COMPONENT_PATHS) app.use(path, requireSession(auth));
  app.on(WRITE_METHODS, STUDIO_PATH, requireSession(auth));
  app.on(WRITE_METHODS, [STUDIO_PATH, ...COMPONENT_PATHS], requireAdmin);

  const studio = createStudioRoutes(stores.releases);
  app.route('/api/studio', studio);
  app.route('/api/components', createComponentRoutes(stores.components));

  // Remote MCP endpoint (claude.ai connector), read-only. Its Studio tools call the Studio routes
  // in-process, which skips the session check above on purpose: the connector has no browser session.
  const studioClient = createStudioClient(async (path) => studio.request(path));
  app.all(MCP_PATH, (c) => handleMcpRequest(c.req.raw, studioClient));

  app.notFound((c) => errorResponse(c, 404, 'not_found', `No route for ${c.req.method} ${c.req.path}.`));
  app.onError((err, c) => {
    if (err instanceof HttpError) return errorResponse(c, err.status, err.code, err.message, err.details);
    console.error('[api] unexpected error:', err);
    return errorResponse(c, 500, 'internal', 'Internal server error.');
  });

  return app;
}
