import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../lib/routes';
import { useFavorites } from '../store/contexts';
import type { Component } from '../types';
import { StatusBadge, SupportBadge } from './Badges';
import { Stars } from './Stars';

export function ComponentIcon({ c, size = 48 }: { c: Pick<Component, 'color' | 'icon'>; size?: number }) {
  const style = { '--c': c.color, width: size, height: size, fontSize: size * 0.42 } as CSSProperties;
  return (
    <div className="c-icon" style={style}>
      <span>{c.icon}</span>
    </div>
  );
}

export function FavoriteButton({
  c,
  className = '',
  withLabel = false,
}: {
  c: Pick<Component, 'id' | 'name'>;
  className?: string;
  withLabel?: boolean;
}) {
  const { favorites, toggleFavorite } = useFavorites();
  const isFavorite = favorites.includes(c.id);
  return (
    <button
      className={`fav-btn ${isFavorite ? 'on' : ''} ${className}`}
      aria-pressed={isFavorite}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => {
        // The button sits inside a card link: don't navigate.
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(c.id, c.name);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 13.5s-5.5-3.2-5.5-7A2.9 2.9 0 0 1 8 4.8a2.9 2.9 0 0 1 5.5 1.7c0 3.8-5.5 7-5.5 7z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      {withLabel && <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>}
    </button>
  );
}

export function ComponentCard({ c }: { c: Component }) {
  const isOwnUnpublished = c.status !== undefined && c.status !== 'published';
  return (
    <Link to={routes.component(c.slug)} className="card">
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
        {isOwnUnpublished && c.status ? <StatusBadge status={c.status} /> : <SupportBadge support={c.support} />}
      </div>
    </Link>
  );
}
