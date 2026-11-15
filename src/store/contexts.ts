// Context objects and the hooks that read them. Providers live in the *Provider.tsx files.
import { createContext, useContext, type Context } from 'react';
import type { DownloadRecord, Review, Submission, SubmissionInput, SubmissionStatus } from '../types';

export type Notify = (message: string) => void;

export interface FavoritesValue {
  favorites: number[];
  toggleFavorite: (id: number, name: string) => void;
}

export interface ReviewsValue {
  userReviews: Record<number, Review[]>;
  addReview: (componentId: number, review: Review) => void;
}

export interface DownloadsValue {
  downloads: DownloadRecord[];
  recordDownload: (componentId: number, version: string, name: string) => void;
}

export interface SubmissionsValue {
  submissions: Submission[];
  submitComponent: (input: SubmissionInput) => Submission;
  /** Returns null if the submission no longer exists or is no longer pending. */
  updateSubmission: (id: number, input: SubmissionInput) => Submission | null;
  withdrawSubmission: (id: number) => void;
  setSubmissionStatus: (id: number, status: SubmissionStatus) => void;
}

export const NotifyContext = createContext<Notify | null>(null);
export const FavoritesContext = createContext<FavoritesValue | null>(null);
export const ReviewsContext = createContext<ReviewsValue | null>(null);
export const DownloadsContext = createContext<DownloadsValue | null>(null);
export const SubmissionsContext = createContext<SubmissionsValue | null>(null);

function useRequired<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (value === null) throw new Error(`${name} must be used inside <AppProviders>`);
  return value;
}

export const useNotify = (): Notify => useRequired(NotifyContext, 'useNotify');
export const useFavorites = (): FavoritesValue => useRequired(FavoritesContext, 'useFavorites');
export const useReviews = (): ReviewsValue => useRequired(ReviewsContext, 'useReviews');
export const useDownloads = (): DownloadsValue => useRequired(DownloadsContext, 'useDownloads');
export const useSubmissions = (): SubmissionsValue => useRequired(SubmissionsContext, 'useSubmissions');
