import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NotifyContext } from './contexts';

const TOAST_MS = 2800;

/** Provides `useNotify()`; shows one toast at a time, after the app content. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const notify = useCallback((message: string) => setToast({ message, key: Date.now() }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      {toast && (
        <div className="toast" key={toast.key} role="status">
          {toast.message}
        </div>
      )}
    </NotifyContext.Provider>
  );
}
