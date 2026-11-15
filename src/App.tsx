import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ExplorePage />} />
        <Route path="components" element={<ExplorePage />} />
        <Route path="components/:slug" element={<ComponentDetailPage />} />
        <Route path="link/components" element={<Navigate to={routes.explore()} replace />} />
        <Route path="studio" element={<StudioPage />} />
        <Route path="studio/manage" element={<StudioManagePage />} />
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
