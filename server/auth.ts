// Sign-in: the built-in accounts, signed session cookies, and the middleware that guards the API.
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';
import type { z } from 'zod';
import { LoginSchema, SessionUserSchema, type Role, type Session, type SessionUser } from '../shared/auth';
import { HttpError } from './http-error';
import { parseBody } from './validation';

export interface Account {
  username: string;
  password: string;
  role: Role;
}

/** Demo accounts. Override the passwords with the USER_PASSWORD / ADMIN_PASSWORD env vars (or Worker secrets). */
export const DEFAULT_ACCOUNTS: readonly Account[] = [
  { username: 'user', password: 'user123', role: 'user' },
  { username: 'admin', password: 'admin123', role: 'admin' },
];

export interface AccountEnv {
  USER_PASSWORD?: string;
  ADMIN_PASSWORD?: string;
}

const PASSWORD_OVERRIDES: Record<Role, keyof AccountEnv> = { user: 'USER_PASSWORD', admin: 'ADMIN_PASSWORD' };

export function accountsFromEnv(env: AccountEnv): Account[] {
  return DEFAULT_ACCOUNTS.map((account) => ({
    ...account,
    password: env[PASSWORD_OVERRIDES[account.role]] || account.password,
  }));
}

export interface AuthOptions {
  accounts: readonly Account[];
  /** HMAC key that signs session cookies. Changing it signs everybody out. */
  secret: string;
}

export interface AuthEnv {
  Variables: { user: SessionUser };
}

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TOKEN_ALGORITHM = 'HS256';

// ---------- credentials ----------
async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Compares digests in constant time, so response timing doesn't reveal how much of a password matched. */
async function isSamePassword(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function authenticate(
  accounts: readonly Account[],
  credentials: z.output<typeof LoginSchema>,
): Promise<SessionUser | null> {
  const account = accounts.find((a) => a.username === credentials.username);
  // Hash even for unknown usernames, so timing doesn't reveal which usernames exist.
  const isMatch = await isSamePassword(credentials.password, account?.password ?? '');
  return account && isMatch ? { username: account.username, role: account.role } : null;
}

// ---------- session tokens ----------
export async function createSessionToken(user: SessionUser, secret: string, nowSeconds: number): Promise<string> {
  return sign({ ...user, exp: nowSeconds + SESSION_TTL_SECONDS }, secret, TOKEN_ALGORITHM);
}

/** The user in a valid, unexpired token; null for anything else (missing, tampered, expired). */
export async function readSessionToken(token: string | undefined, secret: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const parsed = SessionUserSchema.safeParse(await verify(token, secret, TOKEN_ALGORITHM));
    return parsed.success ? { username: parsed.data.username, role: parsed.data.role } : null;
  } catch {
    return null;
  }
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const isHttps = (c: Context) => new URL(c.req.url).protocol === 'https:';

const sessionUser = (c: Context, secret: string) => readSessionToken(getCookie(c, SESSION_COOKIE), secret);

// ---------- routes and middleware ----------
/** POST /login, POST /logout and GET /me. Mounted at /api/auth. */
export function createAuthRoutes({ accounts, secret }: AuthOptions): Hono {
  const routes = new Hono();

  routes.post('/login', async (c) => {
    const user = await authenticate(accounts, await parseBody(c, LoginSchema));
    if (!user) throw new HttpError(401, 'invalid_credentials', 'Incorrect username or password.');
    setCookie(c, SESSION_COOKIE, await createSessionToken(user, secret, nowSeconds()), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isHttps(c),
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return c.json({ user } satisfies Session);
  });

  routes.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: isHttps(c) });
    return c.body(null, 204);
  });

  // Answers 200 with `user: null` when signed out, so checking the session never logs a browser error.
  routes.get('/me', async (c) => c.json({ user: await sessionUser(c, secret) } satisfies Session));

  return routes;
}

/** Rejects requests without a valid session cookie; downstream handlers can read `c.var.user`. */
export function requireSession({ secret }: AuthOptions) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = await sessionUser(c, secret);
    if (!user) throw new HttpError(401, 'unauthenticated', 'Sign in to continue. Your session may have expired.');
    c.set('user', user);
    await next();
  });
}

/** Rejects signed-in users who are not admins. Must run after `requireSession`. */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.var.user.role !== 'admin')
    throw new HttpError(403, 'forbidden', 'Only administrators can make changes. Sign in as an admin.');
  await next();
});
