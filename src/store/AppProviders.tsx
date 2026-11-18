import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { DownloadsProvider } from './DownloadsProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { ReviewsProvider } from './ReviewsProvider';
import { SubmissionsProvider } from './SubmissionsProvider';
import { ToastProvider } from './ToastProvider';

/**
 * All app state. ToastProvider is outermost so the others can notify, and the toast renders after the app.
 * The server catalog is provided by App, because it can only load once the user is signed in.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <ReviewsProvider>
            <DownloadsProvider>
              <SubmissionsProvider>{children}</SubmissionsProvider>
            </DownloadsProvider>
          </ReviewsProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
