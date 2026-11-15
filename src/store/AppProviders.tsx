import type { ReactNode } from 'react';
import { DownloadsProvider } from './DownloadsProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { ReviewsProvider } from './ReviewsProvider';
import { SubmissionsProvider } from './SubmissionsProvider';
import { ToastProvider } from './ToastProvider';

/** All app state. ToastProvider is outermost so the others can notify, and the toast renders after the app. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <ReviewsProvider>
          <DownloadsProvider>
            <SubmissionsProvider>{children}</SubmissionsProvider>
          </DownloadsProvider>
        </ReviewsProvider>
      </FavoritesProvider>
    </ToastProvider>
  );
}
