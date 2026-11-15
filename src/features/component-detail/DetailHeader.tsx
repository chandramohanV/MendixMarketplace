import type { CSSProperties } from 'react';
import { Icon } from '../../components/icons';
import { FavoriteButton } from '../../components/ComponentCard';
import { StatusBadge, SupportBadge } from '../../components/Badges';
import { useNotify } from '../../store/contexts';
import type { Component } from '../../types';
import { isPublic, requiredStudio } from './detail';

export function DetailHeader({ c, onUseInStudio }: { c: Component; onUseInStudio: () => void }) {
  const notify = useNotify();
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Link copied to clipboard');
    } catch {
      notify('Could not copy link');
    }
  };
  const isOwnUnpublished = c.status !== undefined && c.status !== 'published';

  return (
    <header className="detail-head">
      <div className="detail-image" style={{ '--c': c.color } as CSSProperties}>
        <span>{c.icon}</span>
      </div>
      <div className="detail-title">
        {isOwnUnpublished && c.status ? <StatusBadge status={c.status} /> : <SupportBadge support={c.support} long />}
        <h1>{c.name}</h1>
        <div className="detail-sub">
          Latest V {c.version} · Require Studio {requiredStudio(c)} or higher
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary lg" onClick={onUseInStudio}>
            Use in Studio
          </button>
          {isPublic(c) && <FavoriteButton c={c} className="btn btn-secondary lg" withLabel />}
          <button className="btn btn-secondary lg" onClick={share}>
            <Icon name="share" /> Share
          </button>
        </div>
      </div>
    </header>
  );
}
