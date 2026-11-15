import { useMemo } from 'react';
import { COMPONENTS } from '../data/components';
import { buildCatalog, type Catalog } from '../lib/catalog';
import { useSubmissions } from './contexts';

/** The live catalog: dummy components plus the current user's submissions. */
export function useCatalog(): Catalog {
  const { submissions } = useSubmissions();
  return useMemo(() => buildCatalog(COMPONENTS, submissions), [submissions]);
}
