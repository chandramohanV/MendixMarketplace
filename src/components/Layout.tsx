import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAuth, useFavorites, useNotify } from '../store/contexts';
import { Icon, type IconName } from './icons';
import { routes } from '../lib/routes';

function TopBar({ onMenu }: { onMenu: () => void }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(routes.explore({ q: q.trim() }));
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
        <Link to={routes.guidelines} className="topbar-icon" title="Help">
          <Icon name="help" />
        </Link>
        <Link to={routes.myMarketplace()} className="topbar-avatar" title="Demo User – My Marketplace">
          DU
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

/** Who is signed in, with which role, and a way to sign out. */
function UserMenu() {
  const { user, logout } = useAuth();
  const notify = useNotify();
  if (!user) return null;
  const signOut = () => logout().catch(() => notify('Could not sign out. Check your connection and try again.'));
  return (
    <div className="topbar-user">
      <span className="topbar-username">{user.username}</span>
      <span className={`role-badge ${user.role}`}>{user.role}</span>
      <button className="topbar-signout" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  active,
  children,
}: {
  to: string;
  icon: IconName;
  label: string;
  /** Overrides NavLink's own active matching (Explore is active for several paths). */
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${(active ?? isActive) ? 'active' : ''}`} title={label}>
      <Icon name={icon} />
      <span className="nav-text">{label}</span>
      {children}
    </NavLink>
  );
}

function Sidebar({ open, collapsed, onCollapse }: { open: boolean; collapsed: boolean; onCollapse: () => void }) {
  const { favorites } = useFavorites();
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const exploreActive = pathname === routes.home || pathname.startsWith(routes.explore());
  return (
    <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar navigation">
      <nav className="nav-group">
        <NavItem to={routes.explore()} icon="explore" label="Explore" active={exploreActive} />
        <NavItem to={routes.myMarketplace()} icon="heart" label="My Marketplace">
          {favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}
        </NavItem>
        <NavItem to={routes.publishers} icon="building" label="Publishers" />
        <NavItem to={routes.submit} icon="upload" label="Contribute" />
      </nav>
      <div className="nav-sep" />
      <nav className="nav-group">
        <NavLink
          to={routes.studio}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title="Download Studio"
        >
          <span className="studio-mark">bx</span>
          <span className="nav-text">Download Studio</span>
        </NavLink>
        <NavItem to={routes.guidelines} icon="book" label="Guidelines" />
        {isAdmin && <NavItem to={routes.admin} icon="shield" label="Admin" />}
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

function Footer() {
  return (
    <footer className="footer">
      <span>© BloxMarket demo 2026. All data is fictional.</span>
      <Link to={routes.guidelines}>Terms of Use</Link>
      <Link to={routes.guidelines}>Privacy Policy</Link>
      <Link to={routes.guidelines}>Publishing Guidelines</Link>
      <span className="footer-cookie">
        <Icon name="cookie" /> Cookie Settings
      </span>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const isComponentPage = useMatch(routes.component(':slug'));
  const isStudioPage = useMatch(routes.studio);
  const isStudioManagePage = useMatch(routes.studioManage);
  const isAdminPage = useMatch(routes.admin);
  // These pages use the full width, without the sidebar.
  const isFullWidthPage = Boolean(isComponentPage || isStudioPage || isStudioManagePage || isAdminPage);
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
        {!isFullWidthPage && (
          <Sidebar open={menuOpen} collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} />
        )}
        {/* Mouse convenience only: the backdrop covers the page while the mobile menu is open. */}
        {menuOpen && !isFullWidthPage && (
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
