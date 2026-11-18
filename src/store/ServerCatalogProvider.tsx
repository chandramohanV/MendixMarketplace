// Loads the component catalog from the API once the user is signed in, and shows loading/error states
// until it arrives, so pages can read the catalog synchronously through useCatalog().
import { useMemo, type ReactNode } from 'react';
import { listComponents } from '../features/admin/api';
import { useApiQuery } from '../lib/useApiQuery';
import { ServerCatalogContext, type ServerCatalogValue } from './contexts';

export function ServerCatalogProvider({ children }: { children: ReactNode }) {
  const query = useApiQuery('components', listComponents);
  // Keep showing the previous catalog while a reload is in flight, so pages don't flash a spinner.
  const components = query.data ?? query.previous;
  const { reload } = query;
  const value = useMemo<ServerCatalogValue | null>(
    () => (components ? { components, reload } : null),
    [components, reload],
  );

  if (query.error && !value) {
    return (
      <div className="app-status inline-error" role="alert">
        <span>Couldn't load the marketplace catalog. {query.error.message}</span>
        <button className="btn btn-secondary sm" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!value) {
    return (
      <p className="app-status muted" role="status">
        Loading the marketplace…
      </p>
    );
  }
  return <ServerCatalogContext.Provider value={value}>{children}</ServerCatalogContext.Provider>;
}
