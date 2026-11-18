// Typed client for the sign-in API (/api/auth).
import { SessionSchema, type LoginInput, type SessionUser } from '../../../shared/auth';
import { createApiRequest, toJsonBody } from '../../lib/api';

const request = createApiRequest('/api/auth', 'server');

export const getSessionUser = async (signal?: AbortSignal): Promise<SessionUser | null> =>
  (await request('/me', SessionSchema, { signal })).user;

export async function login(input: LoginInput): Promise<SessionUser> {
  const { user } = await request('/login', SessionSchema, { method: 'POST', body: toJsonBody(input) });
  if (!user) throw new Error('The server accepted the sign-in but returned no user.');
  return user;
}

export async function logout(): Promise<void> {
  await request('/logout', null, { method: 'POST' });
}
