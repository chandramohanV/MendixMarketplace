import { useMemo } from 'react';
import { buildCatalog, type Catalog } from '../lib/catalog';
import { useServerCatalog, useSubmissions } from './contexts';

/** The live catalog: the server's components plus the current user's submissions. */
export function useCatalog(): Catalog {
  const { components } = useServerCatalog();
  const { submissions } = useSubmissions();
  return useMemo(() => buildCatalog(components, submissions), [components, submissions]);
}
