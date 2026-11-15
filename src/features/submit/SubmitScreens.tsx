import { Link } from 'react-router-dom';
import { getAutoPublishMs } from '../../lib/demoSettings';
import { routes } from '../../lib/routes';
import type { Submission } from '../../types';
import { STEPS } from './submitForm';

function stepClass(index: number, current: number): string {
  if (index === current) return 'active';
  return index < current ? 'done' : '';
}

export function SubmitStepper({ step }: { step: number }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, i) => (
        <li key={label} className={stepClass(i, step)} aria-current={i === step ? 'step' : undefined}>
          <span aria-hidden="true">{i < step ? '✓' : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function autoPublishWait(): string {
  const seconds = Math.round(getAutoPublishMs() / 1000);
  return seconds < 120 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`;
}

export function SubmitSuccess({
  submission,
  isEdit,
  onSubmitAnother,
}: {
  submission: Submission;
  isEdit: boolean;
  onSubmitAnother: () => void;
}) {
  return (
    <div className="container page narrow center submit-done">
      <div className="empty-icon" aria-hidden="true">
        🎉
      </div>
      <h1>{isEdit ? 'Submission updated' : 'Submission received'}</h1>
      <p className="muted">
        <b>{submission.name}</b> v{submission.version} is pending review. In this demo it is approved and published
        automatically in about {autoPublishWait()}.
      </p>
      <div className="row-center">
        <Link to={routes.component(submission.slug)} className="btn btn-primary">
          View component
        </Link>
        <Link to={routes.myMarketplace('submissions')} className="btn btn-secondary">
          My submissions
        </Link>
        {!isEdit && (
          <button className="btn btn-secondary" onClick={onSubmitAnother}>
            Submit another
          </button>
        )}
      </div>
    </div>
  );
}

export function CannotEditNotice() {
  return (
    <div className="container page narrow center">
      <h1>Submission can't be edited</h1>
      <p className="muted">Only submissions that are still pending review can be edited.</p>
      <Link to={routes.myMarketplace('submissions')} className="btn btn-primary">
        Go to My submissions
      </Link>
    </div>
  );
}
