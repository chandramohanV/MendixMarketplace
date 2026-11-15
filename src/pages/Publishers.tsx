import { Link } from 'react-router-dom';
import { COMPONENTS, PUBLISHER_LIST, formatNumber } from '../data/components';

export default function Publishers() {
  const rows = PUBLISHER_LIST.map((p) => {
    const items = COMPONENTS.filter((c) => c.publisher === p.name);
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
          <Link key={p.name} to={`/components?publisher=${encodeURIComponent(p.name)}`} className="card publisher-card">
            <div className="avatar lg">
              {p.name
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </div>
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
