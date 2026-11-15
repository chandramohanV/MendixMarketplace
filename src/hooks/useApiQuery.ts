import { useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../api/studio';

export interface QueryState<T> {
  data: T | undefined;
  /** Last successful data, kept while a new request loads (avoids layout jumps). */
  previous: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => void;
}

const toApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError(0, 'unknown', e instanceof Error ? e.message : 'Unknown error');

/**
 * Fetches whenever `key` changes; the previous request is aborted so stale responses never win.
 * Loading is derived (the result's key doesn't match the current key), so no state is set synchronously in effects.
 */
export function useApiQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): QueryState<T> {
  const [nonce, setNonce] = useState(0);
  const fullKey = `${key}#${nonce}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: ApiError }>({ key: '' });
  const [previous, setPrevious] = useState<T | undefined>(undefined);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const ac = new AbortController();
    fetcherRef.current(ac.signal).then(
      (data) => {
        setResult({ key: fullKey, data });
        setPrevious(data);
      },
      (e: unknown) => {
        if (!isAbortError(e)) setResult({ key: fullKey, error: toApiError(e) });
      },
    );
    return () => ac.abort();
  }, [fullKey]);

  const loading = result.key !== fullKey;
  return {
    data: loading ? undefined : result.data,
    previous,
    error: loading ? undefined : result.error,
    loading,
    reload: () => setNonce((n) => n + 1),
  };
}
