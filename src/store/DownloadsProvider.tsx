import { useCallback, useMemo, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../lib/storageKeys';
import type { DownloadRecord } from '../types';
import { DownloadsContext, useNotify } from './contexts';
import { isArray, usePersistentState } from './persistence';

const MAX_HISTORY = 50;

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const [downloads, setDownloads] = usePersistentState<DownloadRecord[]>(STORAGE_KEYS.downloads, [], isArray);

  const recordDownload = useCallback(
    (componentId: number, version: string, name: string) => {
      setDownloads((prev) =>
        [{ id: componentId, version, date: new Date().toISOString() }, ...prev].slice(0, MAX_HISTORY),
      );
      notify(`Downloading ${name} v${version}…`);
    },
    [notify, setDownloads],
  );

  const value = useMemo(() => ({ downloads, recordDownload }), [downloads, recordDownload]);
  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}
