import { Route, Routes, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Browse from './pages/Browse.jsx'
import Detail from './pages/Detail.jsx'
import Publishers from './pages/Publishers.jsx'
import Submit from './pages/Submit.jsx'
import MyMarketplace from './pages/MyMarketplace.jsx'
import { Guidelines, NotFound } from './pages/Misc.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="components" element={<Browse />} />
        <Route path="components/:slug" element={<Detail />} />
        <Route path="link/components" element={<Navigate to="/components" replace />} />
        <Route path="publishers" element={<Publishers />} />
        <Route path="submit" element={<Submit />} />
        <Route path="my" element={<MyMarketplace />} />
        <Route path="guidelines" element={<Guidelines />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
