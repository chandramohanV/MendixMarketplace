import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate } from '../../data/components';
import { submissionToComponent, useCatalog } from '../../catalog';
import { useStore } from '../../store';
import { ComponentCard, ComponentIcon, StatusBadge } from '../../components/ui';
import type { Component, Review, Submission } from '../../types';
import { routes } from '../../lib/routes';

const TAB_KEYS = ['favorites', 'downloads', 'reviews', 'submissions'] as const;
type TabKey = (typeof TAB_KEYS)[number];
const isTabKey = (v: string | null): v is TabKey => !!v && (TAB_KEYS as readonly string[]).includes(v);

function SubmissionRow({ s }: { s: Submission }) {
  const { withdrawSubmission, setSubmissionStatus } = useStore();
  const [confirming, setConfirming] = useState(false);
  const c = submissionToComponent(s);
  return (
    <tr>
      <td data-label="Component">
        <Link to={routes.component(s.slug)} className="inline-comp">
          <ComponentIcon c={c} size={28} /> {s.name}
        </Link>
      </td>
      <td data-label="Version">v{s.version}</td>
      <td data-label="Status">
        <StatusBadge status={s.status} />
      </td>
      <td data-label="Submitted">{formatDate(s.submittedAt.slice(0, 10))}</td>
      <td className="actions-cell">
        <div className="actions">
          <Link to={routes.component(s.slug)} className="btn btn-secondary sm">
            View
          </Link>
          {s.status === 'pending' && (
            <Link to={routes.submitEdit(s.id)} className="btn btn-secondary sm">
              Edit
            </Link>
          )}
          {s.status === 'pending' && (
            <button className="btn btn-secondary sm" onClick={() => setSubmissionStatus(s.id, 'published')}>
              Approve now (demo)
            </button>
          )}
          {confirming ? (
            <>
              <button className="btn btn-danger sm" onClick={() => withdrawSubmission(s.id)}>
                Confirm withdraw
              </button>
              <button className="btn btn-secondary sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary sm" onClick={() => setConfirming(true)}>
              Withdraw
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function MyMarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { favorites, downloads, userReviews, submissions } = useStore();
  const { findById } = useCatalog();
  const tabParam = params.get('tab');
  const tab: TabKey = isTabKey(tabParam) ? tabParam : 'favorites';

  const favs = favorites.map(findById).filter((c): c is Component => !!c);
  const myReviews = Object.entries(userReviews).flatMap(([id, list]) => {
    const c = findById(Number(id));
    return c ? list.map((r: Review) => ({ ...r, c })) : [];
  });

  const tabs: [TabKey, string][] = [
    ['favorites', `Favorites (${favs.length})`],
    ['downloads', `Downloads (${downloads.length})`],
    ['reviews', `My reviews (${myReviews.length})`],
    ['submissions', `My submissions (${submissions.length})`],
  ];

  return (
    <div className="container page">
      <h1>My Marketplace</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setParams(k === 'favorites' ? {} : { tab: k })}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'favorites' &&
        (favs.length ? (
          <div className="card-grid">
            {favs.map((c) => (
              <ComponentCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">♡</div>
            <h3>No favorites yet</h3>
            <p className="muted">Tap the heart on any component to save it here.</p>
            <Link to={routes.explore()} className="btn btn-primary">
              Browse components
            </Link>
          </div>
        ))}

      {tab === 'downloads' &&
        (downloads.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Version</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((d, i) => {
                const c = findById(d.id);
                return (
                  c && (
                    <tr key={i}>
                      <td>
                        <Link to={routes.component(c.slug)} className="inline-comp">
                          <ComponentIcon c={c} size={28} /> {c.name}
                        </Link>
                      </td>
                      <td>v{d.version}</td>
                      <td>{new Date(d.date).toLocaleString()}</td>
                    </tr>
                  )
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-icon">⤓</div>
            <h3>No downloads yet</h3>
          </div>
        ))}

      {tab === 'reviews' &&
        (myReviews.length ? (
          <div className="reviews">
            {myReviews.map((r, i) => (
              <div key={i} className="review">
                <div className="review-head">
                  <Link to={routes.component(r.c.slug, 'Reviews')}>
                    <b>{r.c.name}</b>
                  </Link>
                  <span className="muted small">{formatDate(r.date)}</span>
                </div>
                <span className="stars-inline">
                  {'★'.repeat(r.stars)}
                  {'☆'.repeat(5 - r.stars)}
                </span>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">✎</div>
            <h3>You haven't written any reviews</h3>
          </div>
        ))}

      {tab === 'submissions' &&
        (submissions.length ? (
          <>
            <div className="submissions-head">
              <p className="muted">
                Pending submissions are only visible to you. In this demo they are approved automatically after a few
                seconds.
              </p>
              <Link to={routes.submit} className="btn btn-primary">
                Submit a component
              </Link>
            </div>
            <table className="table stack-table submissions-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <SubmissionRow key={s.id} s={s} />
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty">
            <div className="empty-icon">⇪</div>
            <h3>No submissions yet</h3>
            <p className="muted">Share your module, widget or connector with the community.</p>
            <Link to={routes.submit} className="btn btn-primary">
              Submit a component
            </Link>
          </div>
        ))}
    </div>
  );
}
