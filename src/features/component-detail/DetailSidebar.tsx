import { Link } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { Stars } from '../../components/Stars';
import { SupportBadge } from '../../components/Badges';
import { SUPPORT_INFO } from '../../data/components';
import { shortDate } from '../../lib/dates';
import { routes } from '../../lib/routes';
import { initials } from '../../lib/text';
import { useNotify } from '../../store/contexts';
import type { Component } from '../../types';
import { requiredStudio } from './detail';

/** Publisher, release picker, downloads, requirements, categories and support. */
export function DetailSidebar({
  c,
  selectedVersion,
  onSelectVersion,
  onDownload,
  onShowReleases,
}: {
  c: Component;
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  onDownload: (version: string) => void;
  onShowReleases: () => void;
}) {
  const notify = useNotify();
  return (
    <aside className="detail-side">
      <div className="panel-subtle publisher-box">
        <div className="publisher-row">
          <span className="pub-logo">{initials(c.publisher)}</span>
          <b>{c.publisher}</b>
        </div>
        <Link to={routes.explore({ publisher: c.publisher })} className="link">
          Company Profile
        </Link>
      </div>

      <div className="side-block no-border">
        <div className="side-label">Latest Release</div>
        <div>V {c.version}</div>
        <div>Updated on {shortDate(c.updated)}</div>
        <button className="text-btn link" onClick={onShowReleases}>
          Other Releases
        </button>
      </div>
      <div className="side-block no-border">
        <div className="side-label">Version</div>
        <select value={selectedVersion} onChange={(e) => onSelectVersion(e.target.value)} aria-label="Select version">
          {c.releases.map((release, i) => (
            <option key={release.version + i} value={release.version}>
              V {release.version}
              {i === 0 ? ' (latest)' : ''}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary block" onClick={() => onDownload(selectedVersion)}>
          <Icon name="download" /> Download
        </button>
      </div>
      <div className="side-block no-border">
        <div className="side-label">Downloads</div>
        <div className="downloads-row">
          <Icon name="download" /> {c.downloads} {c.ratingCount > 0 && <Stars value={c.rating} count={c.ratingCount} />}
        </div>
      </div>
      <div className="side-block">
        <h4>Requirements</h4>
        <div>Require Studio {requiredStudio(c)} or higher</div>
        <div className="side-label mt">License</div>
        <a
          className="link"
          href="#license"
          onClick={(e) => {
            e.preventDefault();
            notify('License links are fictional in this demo');
          }}
        >
          {c.licenseType} <Icon name="external" size={14} />
        </a>
        {c.repo && (
          <>
            <div className="side-label mt">Source</div>
            <a
              className="link"
              href="#repo"
              onClick={(e) => {
                e.preventDefault();
                notify(`Repository: ${c.repo}`);
              }}
            >
              View repository <Icon name="external" size={14} />
            </a>
          </>
        )}
      </div>
      <div className="side-block">
        <h4>Categories</h4>
        <Link to={routes.explore({ category: c.category })} className="tag">
          {c.category}
        </Link>
        {c.industry !== 'Agnostic' && (
          <Link to={routes.explore({ industry: c.industry })} className="tag">
            {c.industry}
          </Link>
        )}
      </div>
      <div className="side-block">
        <h4>Support</h4>
        <SupportBadge support={c.support} long />
        <p className="muted small mt">{SUPPORT_INFO[c.support]}</p>
        <a className="link icon-link" href="#support" onClick={(e) => e.preventDefault()}>
          <Icon name="headset" /> Contact {c.publisher} Support
        </a>
        <Link className="link icon-link" to={routes.guidelines}>
          <Icon name="link" /> Learn about Support Policy
        </Link>
      </div>
    </aside>
  );
}
