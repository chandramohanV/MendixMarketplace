import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export const isArray = (v: unknown): boolean => Array.isArray(v);
export const isPlainObject = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads JSON from localStorage; returns `fallback` if it's missing, corrupt, invalid or storage is unavailable. */
export function loadJson<T>(key: string, fallback: T, isValid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota): keep the state in memory only.
  }
}

/** useState that is loaded from and saved to localStorage under `key`. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (v: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadJson(key, fallback, isValid));
  useEffect(() => {
    saveJson(key, state);
  }, [key, state]);
  return [state, setState];
}
