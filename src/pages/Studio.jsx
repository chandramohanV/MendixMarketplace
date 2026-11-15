import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RELEASES, RELEASE_TYPES, LATEST, RECOMMENDED_LTS, SUPPORTED_LINES, compareVersionsDesc, monthYear, longDate } from '../data/studio';
import { useStore } from '../store';
import { Icon } from '../components/icons';

const PAGE_SIZE = 10;

function TypeBadge({ type, lg = false }) {
  if (!type) return null;
  return <span className={`rbadge rbadge-${type.toLowerCase()} ${lg ? 'lg' : ''}`}>{type}</span>;
}

function Modal({ title, onClose, children, labelledBy = 'modal-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 id={labelledBy}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ReleaseNotes({ release, onDownload }) {
  return (
    <>
      <div className="notes-meta">
        <TypeBadge type={release.type} />
        <span className="muted">Released {longDate(release.date)}</span>
      </div>
      {Object.entries(release.notes).map(([section, items]) => (
        <section key={section} className="notes-section">
          <h3>{section}</h3>
          <ul>{items.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      ))}
      <div className="row-end">
        {release.mac && <button className="btn btn-secondary" onClick={() => onDownload(release, 'MacOS (Beta)')}><Icon name="apple" /> Download for Mac</button>}
        <button className="btn btn-primary" onClick={() => onDownload(release, 'Windows')}><Icon name="windows" /> Download for Windows</button>
      </div>
    </>
  );
}

function VideoCard({ onPlay }) {
  return (
    <button className="video-card" onClick={onPlay} aria-label="Play video: Blox Assist, twice as powerful">
      <div className="video-grid">
        <div className="vtile big"><span>Blox Assist<br />2x as Powerful</span></div>
        <div className="vtile presenter" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="42" r="20" /><path d="M22 120c4-30 20-44 38-44s34 14 38 44z" /></svg>
        </div>
        <div className="vtile"><span className="vlogo">blox</span></div>
        <div className="vtile"><small>STUDIO VERSION</small><b>{LATEST.major}.{LATEST.minor}</b></div>
      </div>
      <span className="play"><Icon name="play" size={28} /></span>
    </button>
  );
}

export default function Studio() {
  const { notify } = useStore();
  const [params, setParams] = useSearchParams();
  const [notesFor, setNotesFor] = useState(null);
  const [video, setVideo] = useState(false);
  const [typesOpen, setTypesOpen] = useState(true);

  const q = params.get('q') || '';
  const line = params.get('line') || '';
  const sort = params.get('sort') || '';
  const page = Math.max(1, Number(params.get('page') || 1));

  // Always build on the *latest* URL: the debounced search update below fires from an
  // older render, and must not overwrite filters chosen in the meantime.
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; });
  const setParam = (k, v, keepPage = false) => {
    const next = new URLSearchParams(paramsRef.current);
    if (v) next.set(k, v); else next.delete(k);
    if (!keepPage) next.delete('page');
    paramsRef.current = next;
    setParams(next, { replace: true });
  };

  // The search box keeps its own state so fast typing never drops characters;
  // results filter immediately and the URL catches up after a short pause.
  const [qInput, setQInput] = useState(q);
  useEffect(() => {
    if (qInput === q) return undefined;
    const id = setTimeout(() => setParam('q', qInput), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);
  const onSearch = (value) => {
    setQInput(value);
    if (page !== 1) setParam('page', '', false);
  };
  const clearFilters = () => { setQInput(''); setParams({}, { replace: true }); };

  const rows = useMemo(() => {
    let list = RELEASES;
    const term = qInput.trim();
    if (term) list = list.filter((r) => r.version.includes(term));
    if (line) list = list.filter((r) => r.line === line);
    if (sort === 'date-asc') list = [...list].sort((a, b) => a.date.localeCompare(b.date) || -compareVersionsDesc(a, b));
    else if (sort === 'date-desc') list = [...list].sort((a, b) => b.date.localeCompare(a.date) || compareVersionsDesc(a, b));
    return list;
  }, [qInput, line, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const start = rows.length ? (cur - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(cur * PAGE_SIZE, rows.length);
  const pageRows = rows.slice(start ? start - 1 : 0, end);
  const goPage = (n) => setParam('page', n > 1 ? String(n) : '', true);
  const cycleSort = () => setParam('sort', sort === 'date-desc' ? 'date-asc' : sort === 'date-asc' ? '' : 'date-desc', false);

  const download = (r, platform) => {
    notify(`Downloading Studio ${r.version} for ${platform}… (demo)`);
  };
  const openNotes = (r) => setNotesFor(r);

  return (
    <div className="studio">
      <section className="studio-hero">
        <div className="studio-hero-inner">
          <div className="studio-intro">
            <h1>Download Studio <TypeBadge type="LTS" lg /></h1>
            <p className="lead-light">Use the Studio IDE to build high-quality applications faster with AI-assisted development.</p>
            <p className="lead-light">Download <button className="inline-link" onClick={() => openNotes(RECOMMENDED_LTS)}>Studio {RECOMMENDED_LTS.version}</button> with Long-Term Support.</p>
            <p className="meta-light">
              Released {monthYear(RECOMMENDED_LTS.date)} · <button className="inline-link" onClick={() => openNotes(RECOMMENDED_LTS)}>Release Notes</button> · Trusted by <button className="inline-link" onClick={() => notify('Customer stories are not part of this demo')}>Industry Leaders</button>
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary lg" onClick={() => download(RECOMMENDED_LTS, 'Windows')}><Icon name="windows" /> Download for Windows</button>
              <button className="btn btn-outline-light lg" onClick={() => download(RECOMMENDED_LTS, 'Mac (Beta)')}><Icon name="apple" /> Download for Mac (Beta)</button>
            </div>
          </div>
          <VideoCard onPlay={() => setVideo(true)} />
        </div>
        <div className="studio-panels">
          <div className="glass-panel">
            <h2>Get Latest Features</h2>
            <p>Download <button className="inline-link" onClick={() => openNotes(LATEST)}>Studio {LATEST.version}</button> for all the latest features.</p>
            <p className="meta-light">Released {monthYear(LATEST.date)} · <button className="inline-link" onClick={() => openNotes(LATEST)}>Release Notes</button></p>
          </div>
          <div className="glass-panel">
            <h2>Build Applications Smarter</h2>
            <p>Learn more about <button className="inline-link" onClick={() => notify('Blox Assist docs are not part of this demo')}>Blox Assist for Smart Development</button>.</p>
            <p className="meta-light"><Icon name="sparkle" /> AI-assisted modeling, review and test generation</p>
          </div>
        </div>
      </section>

      <section className="releases">
        <h2 className="releases-title">All Releases</h2>
        <p>We recommend using a supported version for all production apps to enjoy best stability.<br />
          Having difficulty choosing? Read more about <button className="inline-link dark" onClick={() => setTypesOpen(true)}>Long-term (LTS) vs. Medium-term Support (MTS) version</button>.
        </p>

        <div className="release-types">
          <button className="release-types-toggle" aria-expanded={typesOpen} onClick={() => setTypesOpen((o) => !o)}>
            <span className={`caret ${typesOpen ? 'open' : ''}`}>▸</span> Release Types
          </button>
          {typesOpen && (
            <dl className="types-panel">
              {Object.entries(RELEASE_TYPES).map(([k, v]) => (
                <div key={k} className="type-row"><dt><TypeBadge type={k} /></dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
        </div>

        <div className="release-controls">
          <div className="input-icon">
            <input value={qInput} onChange={(e) => onSearch(e.target.value)} placeholder="Search by Version Number" aria-label="Search by version number" />
            <Icon name="search" />
          </div>
          <select value={line} onChange={(e) => setParam('line', e.target.value)} aria-label="Select supported version">
            <option value="">Select Supported Version</option>
            {SUPPORTED_LINES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div className="table-wrap">
          <table className="release-table">
            <thead>
              <tr>
                <th scope="col">Version Number</th>
                <th scope="col" aria-sort={sort === 'date-asc' ? 'ascending' : sort === 'date-desc' ? 'descending' : 'none'}>
                  <button className="th-sort" onClick={cycleSort}>Release Date <Icon name="sort" className={sort ? 'on' : ''} /></button>
                </th>
                <th scope="col">Release Notes</th>
                <th scope="col" className="th-download">Download</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.version}>
                  <td data-label="Version">
                    <button className="version-link" onClick={() => openNotes(r)}>{r.version}</button>
                    <TypeBadge type={r.type} />
                  </td>
                  <td data-label="Released">{longDate(r.date)}</td>
                  <td data-label="Notes"><button className="notes-link" onClick={() => openNotes(r)}><Icon name="doc" /> Release Notes</button></td>
                  <td className="dl-cell">
                    {r.mac ? <button className="dl-link" onClick={() => download(r, 'MacOS (Beta)')}><Icon name="download" /> MacOS (Beta)</button> : <span className="dl-na" title="Not available for this version">—</span>}
                    <button className="dl-link" onClick={() => download(r, 'Windows')}><Icon name="download" /> Windows</button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={4} className="no-rows">No versions match “{qInput}”{line && ` in ${line}`}. <button className="inline-link dark" onClick={clearFilters}>Clear filters</button></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <nav className="table-pager" aria-label="Release table pages">
          <button className="icon-btn" disabled={cur === 1} onClick={() => goPage(1)} aria-label="First page"><Icon name="first" /></button>
          <button className="icon-btn" disabled={cur === 1} onClick={() => goPage(cur - 1)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
          <span className="pager-status" aria-live="polite">{start} to {end} of {rows.length}</span>
          <button className="icon-btn" disabled={cur === pages} onClick={() => goPage(cur + 1)} aria-label="Next page"><Icon name="chevronRight" /></button>
          <button className="icon-btn" disabled={cur === pages} onClick={() => goPage(pages)} aria-label="Last page"><Icon name="last" /></button>
        </nav>
      </section>

      {notesFor && (
        <Modal title={`Studio ${notesFor.version} Release Notes`} onClose={() => setNotesFor(null)}>
          <ReleaseNotes release={notesFor} onDownload={(r, p) => { download(r, p); setNotesFor(null); }} />
        </Modal>
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
