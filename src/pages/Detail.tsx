import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatDate, SUPPORT_INFO } from '../data/components';
import { useCatalog } from '../catalog';
import { useStore } from '../store';
import { ComponentCard, FavoriteButton, Stars, StatusBadge, SupportBadge } from '../components/ui';
import { Icon } from '../components/icons';
import { NotFound } from './Misc';
import type { Component, Review } from '../types';

const TABS = ['Overview', 'Documentation', 'Releases', 'Reviews', 'Developers'] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string | null): v is Tab => !!v && (TABS as readonly string[]).includes(v);
const DEV_NAMES = [
  'Anna Kowalski',
  'Ravi Shankar',
  'Jonas Meyer',
  'Priya Raman',
  'Tom de Vries',
  'Lena Berg',
  'Carlos Diaz',
  'Mei Lin',
];
const initials = (n: string) =>
  n
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

function RatingBreakdown({ reviews, rating, count }: { reviews: Review[]; rating: number; count: number }) {
  const dist = [5, 4, 3, 2, 1].map((s) => {
    const base = Math.max(0, 1 - Math.abs(s - rating) / 2.2);
    return { s, w: base + reviews.filter((r) => r.stars === s).length * 0.2 };
  });
  const total = dist.reduce((a, d) => a + d.w, 0) || 1;
  return (
    <div className="rating-box">
      <div className="rating-big">
        <b>{count ? rating.toFixed(1) : '–'}</b>
        <Stars value={rating} size={16} />
        <span className="muted small">{count} ratings</span>
      </div>
      <div className="rating-bars">
        {dist.map((d) => (
          <div key={d.s} className="rating-bar">
            <span className="small">{d.s} stars</span>
            <div className="bar">
              <div style={{ width: `${(d.w / total) * 100}%` }} />
            </div>
            <span className="muted small">{Math.round((d.w / total) * count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({ c, onDone }: { c: Component; onDone: () => void }) {
  const { addReview } = useStore();
  const [stars, setStars] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!stars) return setErr('Please select a rating.');
    if (!title.trim() || body.trim().length < 10)
      return setErr('Please add a title and at least 10 characters of feedback.');
    addReview(c.id, {
      author: 'Demo User',
      stars,
      title: title.trim(),
      body: body.trim(),
      date: new Date().toISOString().slice(0, 10),
      helpful: 0,
      mine: true,
    });
    onDone();
  };
  return (
    <form className="review-form panel-subtle" onSubmit={submit}>
      <h3>Write a review</h3>
      <div className="star-input" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            type="button"
            key={s}
            className={s <= stars ? 'on' : ''}
            onClick={() => setStars(s)}
            aria-label={`${s} stars`}
          >
            ★
          </button>
        ))}
      </div>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="What did you like or dislike?"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {err && <div className="form-error">{err}</div>}
      <div className="row-end">
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Post review
        </button>
      </div>
    </form>
  );
}

export default function Detail() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { userReviews, recordDownload, notify } = useStore();
  const { components, findBySlug } = useCatalog();
  const c = findBySlug(slug);
  const [version, setVersion] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [helpful, setHelpful] = useState<Record<number, boolean>>({});

  if (!c) return <NotFound />;

  const tabParam = params.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'Overview';
  const setTab = (t: Tab) => setParams(t === 'Overview' ? {} : { tab: t }, { replace: true });
  const selected = c.releases.find((r) => r.version === version) || c.releases[0];
  const reviews = [...(userReviews[c.id] || []), ...c.reviews];
  const related = components
    .filter((x) => x.id !== c.id && (x.category === c.category || x.publisher === c.publisher))
    .slice(0, 3);
  const devs = c.status
    ? ['Demo User']
    : Array.from({ length: (c.id % 3) + 2 }, (_, i) => DEV_NAMES[(c.id + i * 3) % DEV_NAMES.length]);
  const req = `${c.minPlatform}.0`;
  const isPublic = !c.status || c.status === 'published';

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Link copied to clipboard');
    } catch {
      notify('Could not copy link');
    }
  };

  return (
    <div className="detail">
      <nav className="breadcrumbs">
        <Link to="/">Home</Link> / <Link to={`/components?type=${encodeURIComponent(c.type)}`}>{c.type}</Link> /{' '}
        <span>{c.name}</span>
      </nav>

      {c.support === 'Deprecated' && (
        <div className="alert">This component is deprecated and no longer maintained. Consider an alternative.</div>
      )}
      {c.status === 'pending' && (
        <div className="alert alert-info" role="status">
          This submission is pending review and is only visible to you.{' '}
          <Link to="/my?tab=submissions">Manage your submissions</Link>
        </div>
      )}
      {c.status === 'rejected' && (
        <div className="alert" role="status">
          This submission was rejected and is only visible to you.
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <header className="detail-head">
            <div className="detail-image" style={{ '--c': c.color } as CSSProperties}>
              <span>{c.icon}</span>
            </div>
            <div className="detail-title">
              {c.status && c.status !== 'published' ? (
                <StatusBadge status={c.status} />
              ) : (
                <SupportBadge support={c.support} long />
              )}
              <h1>{c.name}</h1>
              <div className="detail-sub">
                Latest V {c.version} · Require Studio {req} or higher
              </div>
              <div className="detail-actions">
                <button className="btn btn-primary lg" onClick={() => recordDownload(c.id, c.version, c.name)}>
                  Use in Studio
                </button>
                {isPublic && <FavoriteButton c={c} className="btn btn-secondary lg" withLabel />}
                <button className="btn btn-secondary lg" onClick={share}>
                  <Icon name="share" /> Share
                </button>
              </div>
            </div>
          </header>

          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'active' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && (
            <div className="tab-panel prose">
              <h3>Overview</h3>
              {c.description ? (
                c.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="pre-line">
                    {para}
                  </p>
                ))
              ) : (
                <p>
                  {c.short} {c.name} integrates seamlessly with your existing applications and follows platform best
                  practices, helping teams reduce custom development and deliver faster.
                </p>
              )}
              <p>
                NOTE: version {c.version} requires at least Studio version {req}.
                {!c.status &&
                  ' For older Studio versions, use one of the previous releases listed under the Releases tab.'}
              </p>
              {!c.status && (
                <>
                  <h3>Typical usage scenario</h3>
                  <ul>
                    <li>Accelerate delivery of {c.category.toLowerCase()} features</li>
                    <li>Standardize implementation across multiple apps</li>
                    <li>Reduce maintenance with a supported, versioned component</li>
                  </ul>
                </>
              )}
              {c.features.length > 0 && (
                <>
                  <h3>Features and limitations</h3>
                  <ul>
                    {c.features.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 'Documentation' && (
            <div className="tab-panel prose">
              <h3>Installation</h3>
              <ol>
                <li>
                  Click <b>Use in Studio</b>, or download the package from the Releases tab.
                </li>
                <li>
                  Import the package into your app via <code>App › Import module package</code>.
                </li>
                <li>Configure the constants listed below for each environment.</li>
                <li>Add the provided snippets or pages to your navigation.</li>
              </ol>
              <h3>Configuration</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Constant</th>
                    <th>Description</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>{c.name.replace(/\W+/g, '')}.Enabled</code>
                    </td>
                    <td>Turns the component on or off</td>
                    <td>true</td>
                  </tr>
                  <tr>
                    <td>
                      <code>{c.name.replace(/\W+/g, '')}.LogLevel</code>
                    </td>
                    <td>Logging verbosity</td>
                    <td>INFO</td>
                  </tr>
                  <tr>
                    <td>
                      <code>{c.name.replace(/\W+/g, '')}.Timeout</code>
                    </td>
                    <td>Request timeout in seconds</td>
                    <td>30</td>
                  </tr>
                </tbody>
              </table>
              <h3>Dependencies</h3>
              <ul>
                <li>Community Commons (v9+)</li>
                <li>Studio {req} or newer</li>
              </ul>
            </div>
          )}

          {tab === 'Releases' && (
            <div className="tab-panel">
              {c.releases.map((r, i) => (
                <div key={r.version + i} className="release">
                  <div className="release-head">
                    <h3>Version {r.version}</h3>
                    {i === 0 && <span className="badge badge-platform">Latest</span>}
                    <button className="btn btn-secondary sm" onClick={() => recordDownload(c.id, r.version, c.name)}>
                      <Icon name="download" /> Download
                    </button>
                  </div>
                  <div className="muted small">
                    Released {formatDate(r.date)} · Requires Studio {r.minPlatform}.0 or higher
                  </div>
                  <ul>
                    {r.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === 'Reviews' && (
            <div className="tab-panel">
              <RatingBreakdown reviews={reviews} rating={c.rating} count={c.ratingCount} />
              {isPublic &&
                (writing ? (
                  <ReviewForm c={c} onDone={() => setWriting(false)} />
                ) : (
                  <button className="btn btn-primary" onClick={() => setWriting(true)}>
                    Write a review
                  </button>
                ))}
              <div className="reviews">
                {reviews.length === 0 && <p className="muted">No reviews yet.{isPublic && ' Be the first!'}</p>}
                {reviews.map((r, i) => (
                  <div key={i} className="review">
                    <div className="review-head">
                      <span className="avatar">{initials(r.author)}</span>
                      <div>
                        <b>{r.author}</b>
                        {r.mine && <span className="badge badge-community">You</span>}
                        <div className="muted small">{formatDate(r.date)}</div>
                      </div>
                    </div>
                    <Stars value={r.stars} />
                    <h4>{r.title}</h4>
                    <p>{r.body}</p>
                    <button
                      className={`text-btn small ${helpful[i] ? 'on' : ''}`}
                      onClick={() => setHelpful((h) => ({ ...h, [i]: !h[i] }))}
                    >
                      Helpful ({r.helpful + (helpful[i] ? 1 : 0)})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Developers' && (
            <div className="tab-panel">
              <div className="dev-list">
                {devs.map((d) => (
                  <div key={d} className="dev">
                    <span className="avatar lg">{initials(d)}</span>
                    <div>
                      <b>{d}</b>
                      <div className="muted small">{c.publisher}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="detail-side">
          <div className="panel-subtle publisher-box">
            <div className="publisher-row">
              <span className="pub-logo">{initials(c.publisher)}</span>
              <b>{c.publisher}</b>
            </div>
            <Link to={`/components?publisher=${encodeURIComponent(c.publisher)}`} className="link">
              Company Profile
            </Link>
          </div>

          <div className="side-block no-border">
            <div className="side-label">Latest Release</div>
            <div>V {c.version}</div>
            <div>Updated on {formatDate(c.updated)}</div>
            <button className="text-btn link" onClick={() => setTab('Releases')}>
              Other Releases
            </button>
          </div>
          <div className="side-block no-border">
            <div className="side-label">Version</div>
            <select value={selected.version} onChange={(e) => setVersion(e.target.value)} aria-label="Select version">
              {c.releases.map((r, i) => (
                <option key={r.version + i} value={r.version}>
                  V {r.version}
                  {i === 0 ? ' (latest)' : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary block" onClick={() => recordDownload(c.id, selected.version, c.name)}>
              <Icon name="download" /> Download
            </button>
          </div>
          <div className="side-block no-border">
            <div className="side-label">Downloads</div>
            <div className="downloads-row">
              <Icon name="download" /> {c.downloads}{' '}
              {c.ratingCount > 0 && <Stars value={c.rating} count={c.ratingCount} />}
            </div>
          </div>
          <div className="side-block">
            <h4>Requirements</h4>
            <div>Require Studio {req} or higher</div>
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
            <Link to={`/components?category=${encodeURIComponent(c.category)}`} className="tag">
              {c.category}
            </Link>
            {c.industry !== 'Agnostic' && (
              <Link to={`/components?industry=${encodeURIComponent(c.industry)}`} className="tag">
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
            <Link className="link icon-link" to="/guidelines">
              <Icon name="link" /> Learn about Support Policy
            </Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section related">
          <div className="section-head">
            <h2>Related Components</h2>
          </div>
          <div className="card-grid">
            {related.map((r) => (
              <ComponentCard key={r.id} c={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
