import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { slugify } from './data/components';
import { getAutoPublishMs } from './demoSettings';
import type { DownloadRecord, Review, Submission, SubmissionInput, SubmissionStatus } from './types';

/** Submission ids start here so they never collide with catalog ids. */
const SUBMISSION_ID_BASE = 1_000_000;

export interface StoreValue {
  favorites: number[];
  toggleFavorite: (id: number, name: string) => void;
  userReviews: Record<number, Review[]>;
  addReview: (id: number, review: Review) => void;
  downloads: DownloadRecord[];
  recordDownload: (id: number, version: string, name: string) => void;
  submissions: Submission[];
  submitComponent: (input: SubmissionInput) => Submission;
  updateSubmission: (id: number, input: SubmissionInput) => Submission | null;
  withdrawSubmission: (id: number) => void;
  setSubmissionStatus: (id: number, status: SubmissionStatus) => void;
  notify: (message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load<T>(key: string, fallback: T, isValid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}
const isObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<number[]>(() => load('mp.favorites', [], Array.isArray));
  const [userReviews, setUserReviews] = useState<Record<number, Review[]>>(() => load('mp.reviews', {}, isObject));
  const [downloads, setDownloads] = useState<DownloadRecord[]>(() => load('mp.downloads', [], Array.isArray));
  const [submissions, setSubmissions] = useState<Submission[]>(() => load('mp.submissions', [], Array.isArray));
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  // Mirror of the latest submissions so actions can return the record they create synchronously.
  const submissionsRef = useRef(submissions);
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  useEffect(() => {
    save('mp.favorites', favorites);
  }, [favorites]);
  useEffect(() => {
    save('mp.reviews', userReviews);
  }, [userReviews]);
  useEffect(() => {
    save('mp.downloads', downloads);
  }, [downloads]);
  useEffect(() => {
    save('mp.submissions', submissions);
  }, [submissions]);

  const notify = useCallback((message: string) => {
    setToast({ message, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleFavorite = useCallback(
    (id: number, name: string) => {
      setFavorites((prev) => {
        const has = prev.includes(id);
        notify(has ? `Removed "${name}" from favorites` : `Added "${name}" to favorites`);
        return has ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    [notify],
  );

  const addReview = useCallback(
    (id: number, review: Review) => {
      setUserReviews((prev) => ({ ...prev, [id]: [review, ...(prev[id] || [])] }));
      notify('Thanks! Your review has been posted.');
    },
    [notify],
  );

  const recordDownload = useCallback(
    (id: number, version: string, name: string) => {
      setDownloads((prev) => [{ id, version, date: new Date().toISOString() }, ...prev].slice(0, 50));
      notify(`Downloading ${name} v${version}…`);
    },
    [notify],
  );

  const commitSubmissions = useCallback((next: Submission[]) => {
    submissionsRef.current = next;
    setSubmissions(next);
  }, []);

  const submitComponent = useCallback(
    (input: SubmissionInput): Submission => {
      const current = submissionsRef.current;
      const id = Math.max(SUBMISSION_ID_BASE, ...current.map((s) => s.id)) + 1;
      const now = new Date();
      const submission: Submission = {
        ...input,
        name: input.name.trim(),
        id,
        slug: `${id}-${slugify(input.name.trim())}`,
        status: 'pending',
        submittedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        publishAt: new Date(now.getTime() + getAutoPublishMs()).toISOString(),
      };
      commitSubmissions([submission, ...current]);
      return submission;
    },
    [commitSubmissions],
  );

  const updateSubmission = useCallback(
    (id: number, input: SubmissionInput): Submission | null => {
      const current = submissionsRef.current;
      const existing = current.find((s) => s.id === id);
      if (!existing || existing.status !== 'pending') return null;
      const now = new Date();
      const updated: Submission = {
        ...existing,
        ...input,
        name: input.name.trim(),
        slug: `${id}-${slugify(input.name.trim())}`,
        updatedAt: now.toISOString(),
        publishAt: new Date(now.getTime() + getAutoPublishMs()).toISOString(),
      };
      commitSubmissions(current.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    [commitSubmissions],
  );

  const withdrawSubmission = useCallback(
    (id: number) => {
      const s = submissionsRef.current.find((x) => x.id === id);
      commitSubmissions(submissionsRef.current.filter((x) => x.id !== id));
      if (s) notify(`"${s.name}" was withdrawn`);
    },
    [commitSubmissions, notify],
  );

  const setSubmissionStatus = useCallback(
    (id: number, status: SubmissionStatus) => {
      const s = submissionsRef.current.find((x) => x.id === id);
      if (!s || s.status === status) return;
      commitSubmissions(
        submissionsRef.current.map((x) =>
          x.id === id ? { ...x, status, publishAt: null, updatedAt: new Date().toISOString() } : x,
        ),
      );
      notify(status === 'published' ? `"${s.name}" was approved and is now published` : `"${s.name}" was rejected`);
    },
    [commitSubmissions, notify],
  );

  // Demo reviewer: publish each pending submission once its publishAt time arrives.
  useEffect(() => {
    // setTimeout overflows above 2^31-1 ms (~24.8 days) and would fire immediately, so publish
    // times further out than that are not scheduled in this session.
    const MAX_TIMER_MS = 2 ** 31 - 1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const s of submissions) {
      if (s.status !== 'pending' || !s.publishAt) continue;
      const delay = Math.max(0, Date.parse(s.publishAt) - Date.now());
      if (delay <= MAX_TIMER_MS) timers.push(setTimeout(() => setSubmissionStatus(s.id, 'published'), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [submissions, setSubmissionStatus]);

  const value: StoreValue = {
    favorites,
    toggleFavorite,
    userReviews,
    addReview,
    downloads,
    recordDownload,
    submissions,
    submitComponent,
    updateSubmission,
    withdrawSubmission,
    setSubmissionStatus,
    notify,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" key={toast.key} role="status">
          {toast.message}
        </div>
      )}
    </StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
