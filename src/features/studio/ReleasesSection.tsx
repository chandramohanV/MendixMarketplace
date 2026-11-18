import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { RELEASE_TYPE_INFO, type ReleaseList, type ReleaseType, type StudioSummary } from '../../../shared/studio';
import { longDate } from '../../lib/dates';
import { routes } from '../../lib/routes';
import { useAuth } from '../../store/contexts';
import type { ApiError } from './api';
import type { DownloadHandler } from './ReleaseNotesDialog';
import { SkeletonRows, TypeBadge } from './ui';
import type { ReleaseSort, useReleaseFilters } from './useReleaseFilters';

export const RELEASES_PAGE_SIZE = 10;

const ARIA_SORT: Record<ReleaseSort, 'none' | 'ascending' | 'descending'> = {
  '': 'none',
  'date-asc': 'ascending',
  'date-desc': 'descending',
};

function pagerStatus(isLoading: boolean, hasFailed: boolean, first: number, last: number, total: number): string {
  if (isLoading) return 'Loading…';
  if (hasFailed) return '—';
  return `${first} to ${last} of ${total}`;
}

/** "All Releases": type legend, search/filter controls, the release table and its pager. */
export function ReleasesSection({
  filters,
  summary,
  list,
  onOpenNotes,
  onDownload,
}: {
  filters: ReturnType<typeof useReleaseFilters>;
  summary: StudioSummary | undefined;
  list: {
    data: ReleaseList | undefined;
    previous: ReleaseList | undefined;
    error: ApiError | undefined;
    loading: boolean;
    reload: () => void;
  };
  onOpenNotes: (version: string) => void;
  onDownload: DownloadHandler;
}) {
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const { isAdmin } = useAuth();
  const { q, line, sort, page } = filters;
  const types = (summary?.types ?? RELEASE_TYPE_INFO) as Record<ReleaseType, string>;

  const total = (list.data ?? list.previous)?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / RELEASES_PAGE_SIZE));
  const current = Math.min(page, pages);
  const first = total ? (current - 1) * RELEASES_PAGE_SIZE + 1 : 0;
  const last = Math.min(current * RELEASES_PAGE_SIZE, total);
  const isOnFirstPage = current === 1 || list.loading;
  const isOnLastPage = current === pages || list.loading || Boolean(list.error);

  return (
    <section className="releases">
      <div className="releases-head">
        <h2 className="releases-title">All Releases</h2>
        {isAdmin && (
          <Link to={routes.studioManage} className="btn btn-secondary sm">
            Manage releases
          </Link>
        )}
      </div>
      <p>
        We recommend using a supported version for all production apps to enjoy best stability.
        <br />
        Having difficulty choosing? Read more about{' '}
        <button className="inline-link dark" onClick={() => setIsLegendOpen(true)}>
          Long-term (LTS) vs. Medium-term Support (MTS) version
        </button>
        .
      </p>

      <div className="release-types">
        <button
          className="release-types-toggle"
          aria-expanded={isLegendOpen}
          onClick={() => setIsLegendOpen((o) => !o)}
        >
          <span className={`caret ${isLegendOpen ? 'open' : ''}`}>▸</span> Release Types
        </button>
        {isLegendOpen && (
          <dl className="types-panel">
            {(Object.keys(types) as ReleaseType[]).map((type) => (
              <div key={type} className="type-row">
                <dt>
                  <TypeBadge type={type} />
                </dt>
                <dd>{types[type]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="release-controls">
        <div className="input-icon">
          <input
            value={filters.searchInput}
            onChange={(e) => filters.setSearchInput(e.target.value)}
            placeholder="Search by Version Number"
            aria-label="Search by version number"
          />
          <Icon name="search" />
        </div>
        <select value={line} onChange={(e) => filters.setLine(e.target.value)} aria-label="Select supported version">
          <option value="">Select Supported Version</option>
          {summary?.supportedLines.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
          {line && !summary?.supportedLines.some((l) => l.value === line) && <option value={line}>{line}</option>}
        </select>
      </div>

      <div className="table-wrap">
        <table className="release-table" aria-busy={list.loading || undefined}>
          <thead>
            <tr>
              <th scope="col">Version Number</th>
              <th scope="col" aria-sort={ARIA_SORT[sort]}>
                <button className="th-sort" onClick={filters.cycleSort}>
                  Release Date <Icon name="sort" className={sort ? 'on' : ''} />
                </button>
              </th>
              <th scope="col">Release Notes</th>
              <th scope="col" className="th-download">
                Download
              </th>
            </tr>
          </thead>
          <tbody>
            {list.loading && <SkeletonRows rows={RELEASES_PAGE_SIZE} cols={4} />}
            {list.error && (
              <tr>
                <td colSpan={4} className="no-rows">
                  <div className="inline-error center-row" role="alert">
                    <span>Couldn't load releases. {list.error.message}</span>
                    <button className="btn btn-secondary sm" onClick={list.reload}>
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {list.data?.items.map((r) => (
              <tr key={r.version}>
                <td data-label="Version">
                  <button className="version-link" onClick={() => onOpenNotes(r.version)}>
                    {r.version}
                  </button>
                  <TypeBadge type={r.type} />
                </td>
                <td data-label="Released">{longDate(r.date)}</td>
                <td data-label="Notes">
                  <button className="notes-link" onClick={() => onOpenNotes(r.version)}>
                    <Icon name="doc" /> Release Notes
                  </button>
                </td>
                <td className="dl-cell">
                  {r.mac ? (
                    <button className="dl-link" onClick={() => onDownload(r, 'MacOS (Beta)')}>
                      <Icon name="download" /> MacOS (Beta)
                    </button>
                  ) : (
                    <span className="dl-na" title="Not available for this version">
                      —
                    </span>
                  )}
                  <button className="dl-link" onClick={() => onDownload(r, 'Windows')}>
                    <Icon name="download" /> Windows
                  </button>
                </td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="no-rows">
                  No versions match “{q}”{line && ` in ${line}`}.{' '}
                  <button className="inline-link dark" onClick={filters.clearFilters}>
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="table-pager" aria-label="Release table pages">
        <button
          className="icon-btn"
          disabled={isOnFirstPage}
          onClick={() => filters.goToPage(1)}
          aria-label="First page"
        >
          <Icon name="first" />
        </button>
        <button
          className="icon-btn"
          disabled={isOnFirstPage}
          onClick={() => filters.goToPage(current - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="pager-status" aria-live="polite">
          {pagerStatus(list.loading, Boolean(list.error), first, last, total)}
        </span>
        <button
          className="icon-btn"
          disabled={isOnLastPage}
          onClick={() => filters.goToPage(current + 1)}
          aria-label="Next page"
        >
          <Icon name="chevronRight" />
        </button>
        <button
          className="icon-btn"
          disabled={isOnLastPage}
          onClick={() => filters.goToPage(pages)}
          aria-label="Last page"
        >
          <Icon name="last" />
        </button>
      </nav>
    </section>
  );
}
