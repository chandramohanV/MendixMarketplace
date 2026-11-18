// Holds the signed-in user. The session itself is an HttpOnly cookie the server sets; this only mirrors it.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, SessionUser } from '../../shared/auth';
import * as authApi from '../features/auth/api';
import { isAbortError } from '../lib/api';
import { AuthContext, type AuthValue } from './contexts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    authApi.getSessionUser(ac.signal).then(
      (current) => {
        setUser(current);
        setIsChecking(false);
      },
      (e: unknown) => {
        if (isAbortError(e)) return;
        // Treat an unreachable server as signed out: the login form then shows the real error on submit.
        setIsChecking(false);
      },
    );
    return () => ac.abort();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setUser(await authApi.login(input));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, isChecking, isAdmin: user?.role === 'admin', login, logout }),
    [user, isChecking, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
