// Route guard: renders its children for admins and an explanation for everyone else.
// The API enforces the same rule; this only keeps normal users away from controls they can't use.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { useAuth } from '../../store/contexts';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, user } = useAuth();
  if (isAdmin) return children;
  return (
    <div className="container page narrow center admin-denied" role="alert">
      <h1>Admins only</h1>
      <p className="muted">
        You're signed in as <strong>{user?.username}</strong>, which can browse the marketplace but not change it. Sign
        out and sign in as an administrator to manage components and Studio releases.
      </p>
      <Link className="btn btn-secondary" to={routes.home}>
        Back to Explore
      </Link>
    </div>
  );
}
