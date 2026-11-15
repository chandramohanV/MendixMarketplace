import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { getAutoPublishMs } from '../lib/demoSettings';
import { STORAGE_KEYS } from '../lib/storageKeys';
import type { Submission, SubmissionInput, SubmissionStatus } from '../types';
import { SubmissionsContext, useNotify } from './contexts';
import { isArray, usePersistentState } from './persistence';
import { autoPublishDelay, createSubmission, reviseSubmission } from './submissions';

export function SubmissionsProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const [submissions, setSubmissions] = usePersistentState<Submission[]>(STORAGE_KEYS.submissions, [], isArray);

  // Mirror of the latest list so actions can return the record they create synchronously.
  const submissionsRef = useRef(submissions);
  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  const commit = useCallback(
    (next: Submission[]) => {
      submissionsRef.current = next;
      setSubmissions(next);
    },
    [setSubmissions],
  );

  const submitComponent = useCallback(
    (input: SubmissionInput): Submission => {
      const created = createSubmission(input, submissionsRef.current, new Date(), getAutoPublishMs());
      commit([created, ...submissionsRef.current]);
      return created;
    },
    [commit],
  );

  const updateSubmission = useCallback(
    (id: number, input: SubmissionInput): Submission | null => {
      const existing = submissionsRef.current.find((s) => s.id === id);
      if (!existing || existing.status !== 'pending') return null;
      const updated = reviseSubmission(existing, input, new Date(), getAutoPublishMs());
      commit(submissionsRef.current.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    [commit],
  );

  const withdrawSubmission = useCallback(
    (id: number) => {
      const withdrawn = submissionsRef.current.find((s) => s.id === id);
      commit(submissionsRef.current.filter((s) => s.id !== id));
      if (withdrawn) notify(`"${withdrawn.name}" was withdrawn`);
    },
    [commit, notify],
  );

  const setSubmissionStatus = useCallback(
    (id: number, status: SubmissionStatus) => {
      const target = submissionsRef.current.find((s) => s.id === id);
      if (!target || target.status === status) return;
      const updatedAt = new Date().toISOString();
      commit(submissionsRef.current.map((s) => (s.id === id ? { ...s, status, publishAt: null, updatedAt } : s)));
      notify(
        status === 'published' ? `"${target.name}" was approved and is now published` : `"${target.name}" was rejected`,
      );
    },
    [commit, notify],
  );

  // Demo reviewer: publish each pending submission once its publish time arrives.
  useEffect(() => {
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const s of submissions) {
      const delay = autoPublishDelay(s, now);
      if (delay !== null) timers.push(setTimeout(() => setSubmissionStatus(s.id, 'published'), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [submissions, setSubmissionStatus]);

  const value = useMemo(
    () => ({ submissions, submitComponent, updateSubmission, withdrawSubmission, setSubmissionStatus }),
    [submissions, submitComponent, updateSubmission, withdrawSubmission, setSubmissionStatus],
  );
  return <SubmissionsContext.Provider value={value}>{children}</SubmissionsContext.Provider>;
}
