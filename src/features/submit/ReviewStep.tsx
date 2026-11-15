import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatBytes } from '../../lib/format';
import { routes } from '../../lib/routes';
import type { StepProps } from './stepProps';
import { STEPS, type FormState } from './submitForm';

function summaryRows(form: FormState): [label: string, value: ReactNode][][] {
  return [
    [
      ['Name', form.name.trim()],
      ['Type', form.type],
      ['Category', form.category],
      ['Short description', form.short.trim()],
    ],
    [
      ['Version', form.version.trim()],
      ['Minimum platform', `Studio ${form.minPlatform}+`],
      ['Package', form.file ? `${form.file.name} (${formatBytes(form.file.size)})` : ''],
    ],
    [
      ['License', form.license],
      ['Repository', form.repo.trim()],
      [
        'Full description',
        <span key="d" className="pre-line">
          {form.description.trim()}
        </span>,
      ],
    ],
  ];
}

/** Read-only summary of every step, with "Edit" links, plus the terms checkbox. */
export function ReviewStep({
  form,
  onChange,
  controlProps,
  errorFor,
  onEditStep,
}: StepProps & { onEditStep: (step: number) => void }) {
  const termsError = errorFor('terms');
  return (
    <>
      {summaryRows(form).map((rows, step) => (
        <section key={STEPS[step]} className="review-section">
          <div className="review-section-head">
            <h2>{STEPS[step]}</h2>
            <button
              type="button"
              className="text-btn link"
              onClick={() => onEditStep(step)}
              aria-label={`Edit ${STEPS[step]}`}
            >
              Edit
            </button>
          </div>
          <dl className="facts">
            {rows.map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ))}
      <div className={`field ${termsError ? 'has-error' : ''}`}>
        <label className="check">
          <input type="checkbox" {...controlProps('terms')} checked={form.terms} onChange={onChange('terms')} />
          <span className="check-label">
            I agree to the <Link to={routes.guidelines}>publishing guidelines</Link>
          </span>
        </label>
        {termsError && (
          <div className="field-meta">
            <span className="field-error" id="f-terms-error">
              {termsError}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
