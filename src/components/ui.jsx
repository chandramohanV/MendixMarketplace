import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Icon } from './icons';

const STAR = 'M8 1.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 12l-4.2 2.2.8-4.7L1.2 6.2l4.7-.7z';

export function Stars({ value, size = 14, count }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        const id = `g${i}-${Math.round(fill * 10)}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
            <defs><linearGradient id={id}><stop offset={fill} stopColor="var(--star)" /><stop offset={fill} stopColor="transparent" /></linearGradient></defs>
            <path d={STAR} fill={`url(#${id})`} stroke="var(--star)" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        );
      })}
      {count !== undefined && <span className="star-count">({count})</span>}
    </span>
  );
}

export function ComponentIcon({ c, size = 48 }) {
  return (
    <div className="c-icon" style={{ '--c': c.color, width: size, height: size, fontSize: size * 0.42 }}>
      <span>{c.icon}</span>
    </div>
  );
}

export function SupportBadge({ support, long = false }) {
  if (support === 'Community' && !long) return null;
  const label = long ? `${support} supported` : support;
  return (
    <span className={`badge badge-${support.toLowerCase()}`}>
      {support === 'Partner' && <Icon name="partner" size={10} />}
      {label}
    </span>
  );
}

export function FavoriteButton({ c, className = '', withLabel = false }) {
  const { favorites, toggleFavorite } = useStore();
  const on = favorites.includes(c.id);
  return (
    <button
      className={`fav-btn ${on ? 'on' : ''} ${className}`}
      aria-pressed={on}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(c.id, c.name); }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5s-5.5-3.2-5.5-7A2.9 2.9 0 0 1 8 4.8a2.9 2.9 0 0 1 5.5 1.7c0 3.8-5.5 7-5.5 7z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" /></svg>
      {withLabel && <span>{on ? 'Favorited' : 'Favorite'}</span>}
    </button>
  );
}

export function ComponentCard({ c }) {
  return (
    <Link to={`/components/${c.slug}`} className="card">
      <div className="card-body">
        <div className="card-text">
          <h3 className="card-title">{c.name}</h3>
          <div className="card-publisher">{c.publisher}</div>
          <p className="card-desc">{c.short}</p>
        </div>
        <div className="card-side">
          <ComponentIcon c={c} />
          <FavoriteButton c={c} />
        </div>
      </div>
      <div className="card-foot">
        {c.ratingCount > 0 ? <Stars value={c.rating} count={c.ratingCount} /> : <span />}
        <SupportBadge support={c.support} />
      </div>
    </Link>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
      {nums.map((n, i) =>
        n === '…' ? <span key={`e${i}`} className="ellipsis">…</span> : (
          <button key={n} className={n === page ? 'active' : ''} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>
        ),
      )}
      <button disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Next page"><Icon name="chevronRight" /></button>
    </nav>
  );
}
