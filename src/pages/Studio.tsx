import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RELEASE_TYPE_INFO, type ReleaseListItem, type ReleaseType, type StudioRelease } from '../../shared/studio';
import { getRelease, getSummary, listReleases, type ApiError } from '../api/studio';
import { useApiQuery } from '../hooks/useApiQuery';
import { longDate, monthYear } from '../lib/studioFormat';
import { useStore } from '../store';
import { Icon } from '../components/icons';
import { Modal, SkeletonRows, TypeBadge } from '../components/studio-ui';

const PAGE_SIZE = 10;
type SortParam = '' | 'date-desc' | 'date-asc';
type Downloadable = Pick<ReleaseListItem, 'version'>;

function ReleaseNotesDialog({
  version,
  onClose,
  onDownload,
}: {
  version: string;
  onClose: () => void;
  onDownload: (r: Downloadable, platform: string) => void;
}) {
  const {
    data: release,
    error,
    loading,
    reload,
  } = useApiQuery(`release:${version}`, (signal) => getRelease(version, signal));
  return (
    <Modal title={`Studio ${version} Release Notes`} onClose={onClose}>
      {loading && (
        <p className="muted" role="status">
          Loading release notes…
        </p>
      )}
      {error && (
        <div className="inline-error" role="alert">
          <span>{error.status === 404 ? 'This release no longer exists.' : error.message}</span>
          {error.status !== 404 && (
            <button className="btn btn-secondary sm" onClick={reload}>
              Retry
            </button>
          )}
        </div>
      )}
      {release && <ReleaseNotes release={release} onDownload={onDownload} />}
    </Modal>
  );
}

function ReleaseNotes({
  release,
  onDownload,
}: {
  release: StudioRelease;
  onDownload: (r: Downloadable, platform: string) => void;
}) {
  const sections = Object.entries(release.notes);
  return (
    <>
      <div className="notes-meta">
        <TypeBadge type={release.type} />
        <span className="muted">Released {longDate(release.date)}</span>
      </div>
      {sections.length === 0 && <p className="muted">No release notes were published for this version.</p>}
      {sections.map(([section, items]) => (
        <section key={section} className="notes-section">
          <h3>{section}</h3>
          <ul>
            {items.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
      <div className="row-end">
        {release.mac && (
          <button className="btn btn-secondary" onClick={() => onDownload(release, 'MacOS (Beta)')}>
            <Icon name="apple" /> Download for Mac
          </button>
        )}
        <button className="btn btn-primary" onClick={() => onDownload(release, 'Windows')}>
          <Icon name="windows" /> Download for Windows
        </button>
      </div>
    </>
  );
}

function VideoCard({ onPlay, latest }: { onPlay: () => void; latest: ReleaseListItem | null | undefined }) {
  return (
    <button className="video-card" onClick={onPlay} aria-label="Play video: Blox Assist, twice as powerful">
      <div className="video-grid">
        <div className="vtile big">
          <span>
            Blox Assist
            <br />
            2x as Powerful
          </span>
        </div>
        <div className="vtile presenter" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="42" r="20" />
            <path d="M22 120c4-30 20-44 38-44s34 14 38 44z" />
          </svg>
        </div>
        <div className="vtile">
          <span className="vlogo">blox</span>
        </div>
        <div className="vtile">
          <small>STUDIO VERSION</small>
          <b>{latest ? `${latest.major}.${latest.minor}` : '—'}</b>
        </div>
      </div>
      <span className="play">
        <Icon name="play" size={28} />
      </span>
    </button>
  );
}

/** Hero lines for the recommended LTS release: error, loaded, or loading placeholders. */
function RecommendedRelease({
  error,
  release,
  onRetry,
  onOpenNotes,
  onTrustedClick,
}: {
  error: ApiError | undefined;
  release: ReleaseListItem | null | undefined;
  onRetry: () => void;
  onOpenNotes: (version: string) => void;
  onTrustedClick: () => void;
}) {
  if (error) {
    return (
      <div className="inline-error dark" role="alert">
        <span>Couldn't load the recommended release. {error.message}</span>
        <button className="btn btn-outline-light sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (!release) {
    return (
      <>
        <p className="lead-light">
          <span className="skeleton dark" style={{ width: 260 }} />
        </p>
        <p className="meta-light">
          <span className="skeleton dark" style={{ width: 200 }} />
        </p>
      </>
    );
  }
  return (
    <>
      <p className="lead-light">
        Download{' '}
        <button className="inline-link" onClick={() => onOpenNotes(release.version)}>
          Studio {release.version}
        </button>{' '}
        with Long-Term Support.
      </p>
      <p className="meta-light">
        Released {monthYear(release.date)} ·{' '}
        <button className="inline-link" onClick={() => onOpenNotes(release.version)}>
          Release Notes
        </button>{' '}
        · Trusted by{' '}
        <button className="inline-link" onClick={onTrustedClick}>
          Industry Leaders
        </button>
      </p>
    </>
  );
}

function pagerStatus(loading: boolean, failed: boolean, start: number, end: number, total: number): string {
  if (loading) return 'Loading…';
  if (failed) return '—';
  return `${start} to ${end} of ${total}`;
}

const NEXT_SORT: Record<SortParam, SortParam> = { '': 'date-desc', 'date-desc': 'date-asc', 'date-asc': '' };
const ARIA_SORT: Record<SortParam, 'none' | 'ascending' | 'descending'> = {
  '': 'none',
  'date-asc': 'ascending',
  'date-desc': 'descending',
};

export default function Studio() {
  const { notify } = useStore();
  const [params, setParams] = useSearchParams();
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [video, setVideo] = useState(false);
  const [typesOpen, setTypesOpen] = useState(true);

  const q = params.get('q') || '';
  const line = params.get('line') || '';
  const sortRaw = params.get('sort') || '';
  const sort: SortParam = sortRaw === 'date-desc' || sortRaw === 'date-asc' ? sortRaw : '';
  const page = Math.max(1, Number(params.get('page') || 1) || 1);

  // Always build on the *latest* URL: the debounced search update below fires from an
  // older render, and must not overwrite filters chosen in the meantime.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });
  const setParam = (k: string, v: string, keepPage = false) => {
    const next = new URLSearchParams(paramsRef.current);
    if (v) next.set(k, v);
    else next.delete(k);
    if (!keepPage) next.delete('page');
    paramsRef.current = next;
    setParams(next, { replace: true });
  };

  // The search box keeps its own state so fast typing never drops characters;
  // the URL (and so the server query) catches up after a short pause.
  const [qInput, setQInput] = useState(q);
  useEffect(() => {
    if (qInput === q) return undefined;
    const id = setTimeout(() => setParam('q', qInput.trim() ? qInput : ''), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);
  const clearFilters = () => {
    setQInput('');
    setParams({}, { replace: true });
  };

  const summary = useApiQuery('summary', getSummary);
  const list = useApiQuery(JSON.stringify({ q, line, sort, page }), (signal) =>
    listReleases(
      {
        q: q.trim() || undefined,
        line: line || undefined,
        sort: sort || 'version',
        page,
        pageSize: PAGE_SIZE,
      },
      signal,
    ),
  );

  const s = summary.data;
  const lts = s?.recommendedLts;
  const latest = s?.latest;
  const shown = list.data ?? list.previous;
  const total = shown?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const start = total ? (cur - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(cur * PAGE_SIZE, total);
  const goPage = (n: number) => setParam('page', n > 1 ? String(n) : '', true);
  const cycleSort = () => setParam('sort', NEXT_SORT[sort], false);

  const download = (r: Downloadable, platform: string) =>
    notify(`Downloading Studio ${r.version} for ${platform}… (demo)`);
  const types = (s?.types ?? RELEASE_TYPE_INFO) as Record<ReleaseType, string>;

  return (
    <div className="studio">
      <section className="studio-hero" aria-busy={summary.loading || undefined}>
        <div className="studio-hero-inner">
          <div className="studio-intro">
            <h1>
              Download Studio <TypeBadge type="LTS" lg />
            </h1>
            <p className="lead-light">
              Use the Studio IDE to build high-quality applications faster with AI-assisted development.
            </p>
            <RecommendedRelease
              error={summary.error}
              release={lts}
              onRetry={summary.reload}
              onOpenNotes={setNotesFor}
              onTrustedClick={() => notify('Customer stories are not part of this demo')}
            />
            <div className="hero-actions">
              <button className="btn btn-primary lg" disabled={!lts} onClick={() => lts && download(lts, 'Windows')}>
                <Icon name="windows" /> Download for Windows
              </button>
              <button
                className="btn btn-outline-light lg"
                disabled={!lts}
                onClick={() => lts && download(lts, 'Mac (Beta)')}
              >
                <Icon name="apple" /> Download for Mac (Beta)
              </button>
            </div>
          </div>
          <VideoCard onPlay={() => setVideo(true)} latest={latest} />
        </div>
        <div className="studio-panels">
          <div className="glass-panel">
            <h2>Get Latest Features</h2>
            {latest ? (
              <>
                <p>
                  Download{' '}
                  <button className="inline-link" onClick={() => setNotesFor(latest.version)}>
                    Studio {latest.version}
                  </button>{' '}
                  for all the latest features.
                </p>
                <p className="meta-light">
                  Released {monthYear(latest.date)} ·{' '}
                  <button className="inline-link" onClick={() => setNotesFor(latest.version)}>
                    Release Notes
                  </button>
                </p>
              </>
            ) : (
              <p>
                <span className="skeleton dark" style={{ width: '70%' }} />
              </p>
            )}
          </div>
          <div className="glass-panel">
            <h2>Build Applications Smarter</h2>
            <p>
              Learn more about{' '}
              <button className="inline-link" onClick={() => notify('Blox Assist docs are not part of this demo')}>
                Blox Assist for Smart Development
              </button>
              .
            </p>
            <p className="meta-light">
              <Icon name="sparkle" /> AI-assisted modeling, review and test generation
            </p>
          </div>
        </div>
      </section>

      <section className="releases">
        <div className="releases-head">
          <h2 className="releases-title">All Releases</h2>
          <Link to="/studio/manage" className="btn btn-secondary sm">
            Manage releases
          </Link>
        </div>
        <p>
          We recommend using a supported version for all production apps to enjoy best stability.
          <br />
          Having difficulty choosing? Read more about{' '}
          <button className="inline-link dark" onClick={() => setTypesOpen(true)}>
            Long-term (LTS) vs. Medium-term Support (MTS) version
          </button>
          .
        </p>

        <div className="release-types">
          <button className="release-types-toggle" aria-expanded={typesOpen} onClick={() => setTypesOpen((o) => !o)}>
            <span className={`caret ${typesOpen ? 'open' : ''}`}>▸</span> Release Types
          </button>
          {typesOpen && (
            <dl className="types-panel">
              {(Object.keys(types) as ReleaseType[]).map((k) => (
                <div key={k} className="type-row">
                  <dt>
                    <TypeBadge type={k} />
                  </dt>
                  <dd>{types[k]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="release-controls">
          <div className="input-icon">
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search by Version Number"
              aria-label="Search by version number"
            />
            <Icon name="search" />
          </div>
          <select value={line} onChange={(e) => setParam('line', e.target.value)} aria-label="Select supported version">
            <option value="">Select Supported Version</option>
            {s?.supportedLines.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
            {line && !s?.supportedLines.some((l) => l.value === line) && <option value={line}>{line}</option>}
          </select>
        </div>

        <div className="table-wrap">
          <table className="release-table" aria-busy={list.loading || undefined}>
            <thead>
              <tr>
                <th scope="col">Version Number</th>
                <th scope="col" aria-sort={ARIA_SORT[sort]}>
                  <button className="th-sort" onClick={cycleSort}>
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
              {list.loading && <SkeletonRows rows={PAGE_SIZE} cols={4} />}
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
                    <button className="version-link" onClick={() => setNotesFor(r.version)}>
                      {r.version}
                    </button>
                    <TypeBadge type={r.type} />
                  </td>
                  <td data-label="Released">{longDate(r.date)}</td>
                  <td data-label="Notes">
                    <button className="notes-link" onClick={() => setNotesFor(r.version)}>
                      <Icon name="doc" /> Release Notes
                    </button>
                  </td>
                  <td className="dl-cell">
                    {r.mac ? (
                      <button className="dl-link" onClick={() => download(r, 'MacOS (Beta)')}>
                        <Icon name="download" /> MacOS (Beta)
                      </button>
                    ) : (
                      <span className="dl-na" title="Not available for this version">
                        —
                      </span>
                    )}
                    <button className="dl-link" onClick={() => download(r, 'Windows')}>
                      <Icon name="download" /> Windows
                    </button>
                  </td>
                </tr>
              ))}
              {list.data && list.data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="no-rows">
                    No versions match “{q}”{line && ` in ${line}`}.{' '}
                    <button className="inline-link dark" onClick={clearFilters}>
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
            disabled={cur === 1 || list.loading}
            onClick={() => goPage(1)}
            aria-label="First page"
          >
            <Icon name="first" />
          </button>
          <button
            className="icon-btn"
            disabled={cur === 1 || list.loading}
            onClick={() => goPage(cur - 1)}
            aria-label="Previous page"
          >
            <Icon name="chevronLeft" />
          </button>
          <span className="pager-status" aria-live="polite">
            {pagerStatus(list.loading, !!list.error, start, end, total)}
          </span>
          <button
            className="icon-btn"
            disabled={cur === pages || list.loading || !!list.error}
            onClick={() => goPage(cur + 1)}
            aria-label="Next page"
          >
            <Icon name="chevronRight" />
          </button>
          <button
            className="icon-btn"
            disabled={cur === pages || list.loading || !!list.error}
            onClick={() => goPage(pages)}
            aria-label="Last page"
          >
            <Icon name="last" />
          </button>
        </nav>
      </section>

      {notesFor && (
        <ReleaseNotesDialog
          version={notesFor}
          onClose={() => setNotesFor(null)}
          onDownload={(r, p) => {
            download(r, p);
            setNotesFor(null);
          }}
        />
      )}
      {video && (
        <Modal title="Blox Assist: 2x as Powerful" onClose={() => setVideo(false)}>
          <div className="fake-player">
            <Icon name="play" size={40} />
            <p>Video playback isn't available in this demo.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
