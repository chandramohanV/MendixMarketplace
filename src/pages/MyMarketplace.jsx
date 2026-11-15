import { Link, useSearchParams } from 'react-router-dom';
import { COMPONENTS, formatDate } from '../data/components';
import { useStore } from '../store';
import { ComponentCard, ComponentIcon } from '../components/ui';

export default function MyMarketplace() {
  const [params, setParams] = useSearchParams();
  const { favorites, downloads, userReviews } = useStore();
  const tab = params.get('tab') || 'favorites';
  const favs = COMPONENTS.filter((c) => favorites.includes(c.id));
  const myReviews = Object.entries(userReviews).flatMap(([id, list]) => list.map((r) => ({ ...r, c: COMPONENTS.find((c) => c.id === Number(id)) })));

  return (
    <div className="container page">
      <h1>My Marketplace</h1>
      <div className="tabs">
        {[['favorites', `Favorites (${favs.length})`], ['downloads', `Downloads (${downloads.length})`], ['reviews', `My reviews (${myReviews.length})`]].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setParams(k === 'favorites' ? {} : { tab: k })}>{l}</button>
        ))}
      </div>

      {tab === 'favorites' && (favs.length ? <div className="card-grid">{favs.map((c) => <ComponentCard key={c.id} c={c} />)}</div> : (
        <div className="empty"><div className="empty-icon">♡</div><h3>No favorites yet</h3><p className="muted">Tap the heart on any component to save it here.</p><Link to="/components" className="btn btn-primary">Browse components</Link></div>
      ))}

      {tab === 'downloads' && (downloads.length ? (
        <table className="table">
          <thead><tr><th>Component</th><th>Version</th><th>Date</th></tr></thead>
          <tbody>
            {downloads.map((d, i) => {
              const c = COMPONENTS.find((x) => x.id === d.id);
              return c && (
                <tr key={i}>
                  <td><Link to={`/components/${c.slug}`} className="inline-comp"><ComponentIcon c={c} size={28} /> {c.name}</Link></td>
                  <td>v{d.version}</td>
                  <td>{new Date(d.date).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <div className="empty"><div className="empty-icon">⤓</div><h3>No downloads yet</h3></div>)}

      {tab === 'reviews' && (myReviews.length ? (
        <div className="reviews">
          {myReviews.map((r, i) => (
            <div key={i} className="review">
              <div className="review-head"><Link to={`/components/${r.c.slug}?tab=Reviews`}><b>{r.c.name}</b></Link><span className="muted small">{formatDate(r.date)}</span></div>
              <span className="stars-inline">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
              <h4>{r.title}</h4><p>{r.body}</p>
            </div>
          ))}
        </div>
      ) : <div className="empty"><div className="empty-icon">✎</div><h3>You haven't written any reviews</h3></div>)}
    </div>
  );
}
