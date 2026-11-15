import { useState, type FormEvent } from 'react';
import { Stars } from '../../components/Stars';
import { shortDate } from '../../lib/dates';
import { initials } from '../../lib/text';
import { useReviews } from '../../store/contexts';
import type { Component, Review } from '../../types';
import { ratingDistribution } from './detail';

const MIN_REVIEW_LENGTH = 10;

function RatingBreakdown({ reviews, rating, count }: { reviews: Review[]; rating: number; count: number }) {
  return (
    <div className="rating-box">
      <div className="rating-big">
        <b>{count ? rating.toFixed(1) : '–'}</b>
        <Stars value={rating} size={16} />
        <span className="muted small">{count} ratings</span>
      </div>
      <div className="rating-bars">
        {ratingDistribution(reviews, rating, count).map((row) => (
          <div key={row.stars} className="rating-bar">
            <span className="small">{row.stars} stars</span>
            <div className="bar">
              <div style={{ width: `${row.percent}%` }} />
            </div>
            <span className="muted small">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({ componentId, onDone }: { componentId: number; onDone: () => void }) {
  const { addReview } = useReviews();
  const [stars, setStars] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!stars) {
      setError('Please select a rating.');
      return;
    }
    if (!title.trim() || body.trim().length < MIN_REVIEW_LENGTH) {
      setError('Please add a title and at least 10 characters of feedback.');
      return;
    }
    addReview(componentId, {
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
      <input aria-label="Review title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        aria-label="Review text"
        placeholder="What did you like or dislike?"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <div className="form-error">{error}</div>}
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

/**
 * Rating summary, the review form and the review list. The "writing" and "helpful" state is owned by
 * the page so it survives switching tabs.
 */
export function ReviewsTab({
  c,
  reviews,
  canReview,
  isWritingReview,
  onWritingChange,
  helpfulVotes,
  onToggleHelpful,
}: {
  c: Component;
  reviews: Review[];
  canReview: boolean;
  isWritingReview: boolean;
  onWritingChange: (isWriting: boolean) => void;
  helpfulVotes: Record<number, boolean>;
  onToggleHelpful: (reviewIndex: number) => void;
}) {
  return (
    <div className="tab-panel">
      <RatingBreakdown reviews={reviews} rating={c.rating} count={c.ratingCount} />
      {canReview &&
        (isWritingReview ? (
          <ReviewForm componentId={c.id} onDone={() => onWritingChange(false)} />
        ) : (
          <button className="btn btn-primary" onClick={() => onWritingChange(true)}>
            Write a review
          </button>
        ))}
      <div className="reviews">
        {reviews.length === 0 && <p className="muted">No reviews yet.{canReview && ' Be the first!'}</p>}
        {reviews.map((review, i) => (
          <div key={i} className="review">
            <div className="review-head">
              <span className="avatar">{initials(review.author)}</span>
              <div>
                <b>{review.author}</b>
                {review.mine && <span className="badge badge-community">You</span>}
                <div className="muted small">{shortDate(review.date)}</div>
              </div>
            </div>
            <Stars value={review.stars} />
            <h4>{review.title}</h4>
            <p>{review.body}</p>
            <button className={`text-btn small ${helpfulVotes[i] ? 'on' : ''}`} onClick={() => onToggleHelpful(i)}>
              Helpful ({review.helpful + (helpfulVotes[i] ? 1 : 0)})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
