import { Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Browse from './pages/Browse';
import Detail from './pages/Detail';
import Publishers from './pages/Publishers.jsx';
import Studio from './pages/Studio';
import StudioManage from './pages/StudioManage';
import Submit from './pages/Submit';
import MyMarketplace from './pages/MyMarketplace';
import { Guidelines, NotFound } from './pages/Misc.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="components" element={<Browse />} />
        <Route path="components/:slug" element={<Detail />} />
        <Route path="link/components" element={<Navigate to="/components" replace />} />
        <Route path="studio" element={<Studio />} />
        <Route path="studio/manage" element={<StudioManage />} />
        <Route path="link/studiopro" element={<Navigate to="/studio" replace />} />
        <Route path="publishers" element={<Publishers />} />
        <Route path="submit" element={<Submit />} />
        <Route path="my" element={<MyMarketplace />} />
        <Route path="guidelines" element={<Guidelines />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
