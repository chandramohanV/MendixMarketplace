import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/Badges';
import { ComponentCard, ComponentIcon } from '../../components/ComponentCard';
import { submissionToComponent } from '../../lib/catalog';
import { shortDate } from '../../lib/dates';
import { routes } from '../../lib/routes';
import { useSubmissions } from '../../store/contexts';
import type { Component, DownloadRecord, Review, Submission } from '../../types';

export function FavoritesTab({ favorites }: { favorites: Component[] }) {
  if (favorites.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">♡</div>
        <h3>No favorites yet</h3>
        <p className="muted">Tap the heart on any component to save it here.</p>
        <Link to={routes.explore()} className="btn btn-primary">
          Browse components
        </Link>
      </div>
    );
  }
  return (
    <div className="card-grid">
      {favorites.map((c) => (
        <ComponentCard key={c.id} c={c} />
      ))}
    </div>
  );
}

export function DownloadsTab({
  downloads,
  findById,
}: {
  downloads: DownloadRecord[];
  findById: (id: number) => Component | undefined;
}) {
  if (downloads.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">⤓</div>
        <h3>No downloads yet</h3>
      </div>
    );
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Version</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {downloads.map((download, i) => {
          const c = findById(download.id);
          // Downloads of components that no longer exist (e.g. withdrawn submissions) are skipped.
          if (!c) return null;
          return (
            <tr key={i}>
              <td>
                <Link to={routes.component(c.slug)} className="inline-comp">
                  <ComponentIcon c={c} size={28} /> {c.name}
                </Link>
              </td>
              <td>v{download.version}</td>
              <td>{new Date(download.date).toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function MyReviewsTab({ reviews }: { reviews: (Review & { component: Component })[] }) {
  if (reviews.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">✎</div>
        <h3>You haven't written any reviews</h3>
      </div>
    );
  }
  return (
    <div className="reviews">
      {reviews.map((review, i) => (
        <div key={i} className="review">
          <div className="review-head">
            <Link to={routes.component(review.component.slug, 'Reviews')}>
              <b>{review.component.name}</b>
            </Link>
            <span className="muted small">{shortDate(review.date)}</span>
          </div>
          <span className="stars-inline">
            {'★'.repeat(review.stars)}
            {'☆'.repeat(5 - review.stars)}
          </span>
          <h4>{review.title}</h4>
          <p>{review.body}</p>
        </div>
      ))}
    </div>
  );
}

function SubmissionRow({ submission: s }: { submission: Submission }) {
  const { withdrawSubmission, setSubmissionStatus } = useSubmissions();
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const isPending = s.status === 'pending';
  return (
    <tr>
      <td data-label="Component">
        <Link to={routes.component(s.slug)} className="inline-comp">
          <ComponentIcon c={submissionToComponent(s)} size={28} /> {s.name}
        </Link>
      </td>
      <td data-label="Version">v{s.version}</td>
      <td data-label="Status">
        <StatusBadge status={s.status} />
      </td>
      <td data-label="Submitted">{shortDate(s.submittedAt.slice(0, 10))}</td>
      <td className="actions-cell">
        <div className="actions">
          <Link to={routes.component(s.slug)} className="btn btn-secondary sm">
            View
          </Link>
          {isPending && (
            <Link to={routes.submitEdit(s.id)} className="btn btn-secondary sm">
              Edit
            </Link>
          )}
          {isPending && (
            <button className="btn btn-secondary sm" onClick={() => setSubmissionStatus(s.id, 'published')}>
              Approve now (demo)
            </button>
          )}
          {isConfirmingWithdraw ? (
            <>
              <button className="btn btn-danger sm" onClick={() => withdrawSubmission(s.id)}>
                Confirm withdraw
              </button>
              <button className="btn btn-secondary sm" onClick={() => setIsConfirmingWithdraw(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary sm" onClick={() => setIsConfirmingWithdraw(true)}>
              Withdraw
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function SubmissionsTab({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">⇪</div>
        <h3>No submissions yet</h3>
        <p className="muted">Share your module, widget or connector with the community.</p>
        <Link to={routes.submit} className="btn btn-primary">
          Submit a component
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="submissions-head">
        <p className="muted">
          Pending submissions are only visible to you. In this demo they are approved automatically after a few seconds.
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
            <SubmissionRow key={s.id} submission={s} />
          ))}
        </tbody>
      </table>
    </>
  );
}
