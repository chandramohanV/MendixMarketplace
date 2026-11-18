import { Link } from 'react-router-dom';
import { PUBLISHER_LIST } from '../../data/components';
import { routes } from '../../lib/routes';
import { formatNumber } from '../../lib/format';
import { initials } from '../../lib/text';
import { useServerCatalog } from '../../store/contexts';

export default function PublishersPage() {
  const { components } = useServerCatalog();
  const rows = PUBLISHER_LIST.map((p) => {
    const items = components.filter((c) => c.publisher === p.name);
    const rated = items.filter((c) => c.ratingCount);
    return {
      ...p,
      count: items.length,
      downloads: items.reduce((s, c) => s + c.downloads, 0),
      rating: rated.length ? rated.reduce((s, c) => s + c.rating, 0) / rated.length : 0,
    };
  }).toSorted((a, b) => b.downloads - a.downloads);

  return (
    <div className="container page">
      <h1>Publishers</h1>
      <p className="muted">Companies and community members who share components on the marketplace.</p>
      <div className="publisher-grid">
        {rows.map((p) => (
          <Link key={p.name} to={routes.explore({ publisher: p.name })} className="card publisher-card">
            <div className="avatar lg">{initials(p.name)}</div>
            <h3>
              {p.name}{' '}
              {p.verified && (
                <span className="verified" title="Verified publisher">
                  ✔
                </span>
              )}
            </h3>
            <div className="muted small">{p.country}</div>
            <div className="pub-stats">
              <div>
                <b>{p.count}</b>
                <span>components</span>
              </div>
              <div>
                <b>{formatNumber(p.downloads)}</b>
                <span>downloads</span>
              </div>
              <div>
                <b>{p.rating ? p.rating.toFixed(1) : '–'}</b>
                <span>avg rating</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
