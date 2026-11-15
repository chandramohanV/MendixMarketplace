import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Icon } from './icons';

function TopBar({ onMenu }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/components?q=${encodeURIComponent(q.trim())}` : '/components');
    setQ('');
  };
  return (
    <header className="topbar">
      <button className="topbar-icon apps" onClick={onMenu} aria-label="Toggle navigation">
        <Icon name="apps" />
      </button>
      <Link to="/" className="brand">
        <span className="brand-mark">blox</span>
        <span className="brand-divider" />
        <span className="brand-product">MARKETPLACE</span>
      </Link>
      <form className="topbar-search" onSubmit={submit} role="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          aria-label="Search the marketplace"
        />
        <button type="submit" aria-label="Search">
          <Icon name="search" />
        </button>
      </form>
      <div className="topbar-right">
        <Link to="/guidelines" className="topbar-icon" title="Help">
          <Icon name="help" />
        </Link>
        <Link to="/my" className="topbar-avatar" title="Demo User – My Marketplace">
          DU
        </Link>
      </div>
    </header>
  );
}

function NavItem({ to, icon, label, active, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${(active ?? isActive) ? 'active' : ''}`} title={label}>
      <Icon name={icon} />
      <span className="nav-text">{label}</span>
      {children}
    </NavLink>
  );
}

function Sidebar({ open, collapsed, onCollapse }) {
  const { favorites } = useStore();
  const { pathname } = useLocation();
  const exploreActive = pathname === '/' || pathname.startsWith('/components');
  return (
    <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar navigation">
      <nav className="nav-group">
        <NavItem to="/components" icon="explore" label="Explore" active={exploreActive} />
        <NavItem to="/my" icon="heart" label="My Marketplace">
          {favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}
        </NavItem>
        <NavItem to="/publishers" icon="building" label="Publishers" />
        <NavItem to="/submit" icon="upload" label="Contribute" />
      </nav>
      <div className="nav-sep" />
      <nav className="nav-group">
        <NavLink
          to="/studio"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Download Studio"
        >
          <span className="studio-mark">bx</span>
          <span className="nav-text">Download Studio</span>
        </NavLink>
        <NavItem to="/guidelines" icon="book" label="Guidelines" />
      </nav>
      <button
        className="nav-item collapse-btn"
        onClick={onCollapse}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
        <span className="nav-text">Collapse Menu</span>
      </button>
    </aside>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>© BloxMarket demo 2026. All data is fictional.</span>
      <Link to="/guidelines">Terms of Use</Link>
      <Link to="/guidelines">Privacy Policy</Link>
      <Link to="/guidelines">Publishing Guidelines</Link>
      <span className="footer-cookie">
        <Icon name="cookie" /> Cookie Settings
      </span>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const isComponentPage = useMatch('/components/:slug');
  const isStudioPage = useMatch('/studio');
  const isStudioManagePage = useMatch('/studio/manage');
  const isDetail = isComponentPage || isStudioPage || isStudioManagePage; // full-width pages without the sidebar
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Scroll back to the top whenever the route changes.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    document.querySelector('.main-scroll')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <TopBar onMenu={() => setMenuOpen((o) => !o)} />
      <div className="shell-body">
        {!isDetail && <Sidebar open={menuOpen} collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} />}
        {/* Mouse convenience only: the backdrop covers the page while the mobile menu is open. */}
        {menuOpen && !isDetail && (
          <div className="backdrop" role="presentation" aria-hidden="true" onClick={() => setMenuOpen(false)} />
        )}
        <div className="main-scroll">
          <main>
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
