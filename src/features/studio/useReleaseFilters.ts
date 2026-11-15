import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ReleaseSort = '' | 'date-desc' | 'date-asc';
const NEXT_SORT: Record<ReleaseSort, ReleaseSort> = { '': 'date-desc', 'date-desc': 'date-asc', 'date-asc': '' };
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Release-table filters kept in the URL (?q, ?line, ?sort, ?page). The search box has its own state so
 * fast typing never drops characters; the URL catches up after a short pause.
 */
export function useReleaseFilters() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const line = params.get('line') || '';
  const sortParam = params.get('sort') || '';
  const sort: ReleaseSort = sortParam === 'date-desc' || sortParam === 'date-asc' ? sortParam : '';
  const page = Math.max(1, Number(params.get('page') || 1) || 1);

  // Updates always build on the latest URL (a debounced update fires from an older render), and the
  // updater is stable so the debounce effect below runs only when the search text changes.
  const paramsRef = useRef(params);
  const setParamsRef = useRef(setParams);
  useEffect(() => {
    paramsRef.current = params;
    setParamsRef.current = setParams;
  });
  const setParam = useCallback((key: string, value: string, keepPage = false) => {
    const next = new URLSearchParams(paramsRef.current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (!keepPage) next.delete('page');
    paramsRef.current = next;
    setParamsRef.current(next, { replace: true });
  }, []);

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    if (searchInput === (paramsRef.current.get('q') || '')) return undefined;
    const timer = setTimeout(() => setParam('q', searchInput.trim() ? searchInput : ''), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, setParam]);

  return {
    q,
    line,
    sort,
    page,
    searchInput,
    setSearchInput,
    setLine: (value: string) => setParam('line', value),
    cycleSort: () => setParam('sort', NEXT_SORT[sort]),
    goToPage: (n: number) => setParam('page', n > 1 ? String(n) : '', true),
    clearFilters: () => {
      setSearchInput('');
      setParamsRef.current({}, { replace: true });
    },
  };
}
