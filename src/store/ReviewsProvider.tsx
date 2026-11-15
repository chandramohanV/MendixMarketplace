import { useCallback, useMemo, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../lib/storageKeys';
import type { Review } from '../types';
import { ReviewsContext, useNotify } from './contexts';
import { isPlainObject, usePersistentState } from './persistence';

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const [userReviews, setUserReviews] = usePersistentState<Record<number, Review[]>>(
    STORAGE_KEYS.reviews,
    {},
    isPlainObject,
  );

  const addReview = useCallback(
    (componentId: number, review: Review) => {
      setUserReviews((prev) => ({ ...prev, [componentId]: [review, ...(prev[componentId] || [])] }));
      notify('Thanks! Your review has been posted.');
    },
    [notify, setUserReviews],
  );

  const value = useMemo(() => ({ userReviews, addReview }), [userReviews, addReview]);
  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}
