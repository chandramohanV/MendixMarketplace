import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AdminPage from './features/admin/AdminPage';
import { RequireAdmin } from './features/admin/RequireAdmin';
import LoginPage from './features/auth/LoginPage';
import NotFoundPage from './components/NotFoundPage';
import ComponentDetailPage from './features/component-detail/ComponentDetailPage';
import ExplorePage from './features/explore/ExplorePage';
import GuidelinesPage from './features/guidelines/GuidelinesPage';
import MyMarketplacePage from './features/my-marketplace/MyMarketplacePage';
import PublishersPage from './features/publishers/PublishersPage';
import StudioManagePage from './features/studio/StudioManagePage';
import StudioPage from './features/studio/StudioPage';
import SubmitPage from './features/submit/SubmitPage';
import { routes } from './lib/routes';
import { useAuth } from './store/contexts';
import { ServerCatalogProvider } from './store/ServerCatalogProvider';

/** Every page needs a signed-in user: until then the login screen replaces whatever URL was opened. */
export default function App() {
  const { user, isChecking } = useAuth();
  if (isChecking) {
    return (
      <p className="app-status muted" role="status">
        Checking your session…
      </p>
    );
  }
  if (!user) return <LoginPage />;
  return (
    <ServerCatalogProvider>
      <AppRoutes />
    </ServerCatalogProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ExplorePage />} />
        <Route path="components" element={<ExplorePage />} />
        <Route path="components/:slug" element={<ComponentDetailPage />} />
        <Route path="link/components" element={<Navigate to={routes.explore()} replace />} />
        <Route path="studio" element={<StudioPage />} />
        <Route
          path="studio/manage"
          element={
            <RequireAdmin>
              <StudioManagePage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="link/studiopro" element={<Navigate to={routes.studio} replace />} />
        <Route path="publishers" element={<PublishersPage />} />
        <Route path="submit" element={<SubmitPage />} />
        <Route path="my" element={<MyMarketplacePage />} />
        <Route path="guidelines" element={<GuidelinesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
