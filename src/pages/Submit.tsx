import { Fragment, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TYPES, CATEGORIES, PLATFORM_VERSIONS, LICENSE_TYPES } from '../data/components';
import { useCatalog } from '../catalog';
import { useStore } from '../store';
import { getAutoPublishMs } from '../demoSettings';
import type { ComponentType, PackageFile, Submission, SubmissionInput } from '../types';

const STEPS = ['General', 'Package', 'Details', 'Review'] as const;
const DRAFT_KEY = 'mp.submitDraft';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SHORT_MAX = 160;
const SUBMIT_DELAY_MS = 600;

interface FormState extends SubmissionInput {
  terms: boolean;
}
type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

const STEP_FIELDS: FieldKey[][] = [
  ['name', 'type', 'category', 'short'],
  ['version', 'minPlatform', 'file'],
  ['license', 'repo', 'description'],
  ['terms'],
];

const EMPTY_FORM: FormState = {
  name: '',
  type: TYPES[0],
  category: CATEGORIES[0],
  short: '',
  version: '1.0.0',
  minPlatform: PLATFORM_VERSIONS[1],
  file: null,
  license: LICENSE_TYPES[0],
  repo: '',
  description: '',
  terms: false,
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function validate(form: FormState, isNameTaken: (name: string) => boolean, editing: boolean): Errors {
  const e: Errors = {};
  const name = form.name.trim();
  if (name.length < 3 || name.length > 60) e.name = 'Name must be 3–60 characters.';
  else if (isNameTaken(name)) e.name = `A component named “${name}” already exists. Choose a different name.`;
  const short = form.short.trim().length;
  if (short < 10 || short > SHORT_MAX) e.short = `Short description must be 10–${SHORT_MAX} characters.`;
  if (!/^\d+\.\d+\.\d+$/.test(form.version.trim())) e.version = 'Use semantic versioning, for example 1.0.0.';
  if (!form.file) {
    if (!editing) e.file = 'Choose a package file (.mpk or .zip).';
  } else if (!/\.(mpk|zip)$/i.test(form.file.name)) e.file = 'Package must be a .mpk or .zip file.';
  else if (form.file.size > MAX_FILE_BYTES)
    e.file = `Package must be 50 MB or smaller (this file is ${formatBytes(form.file.size)}).`;
  if (form.repo.trim()) {
    let ok = false;
    try {
      ok = new URL(form.repo.trim()).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) e.repo = 'Repository URL must be a valid https:// address.';
  }
  if (!form.terms) e.terms = 'You must accept the publishing guidelines.';
  return e;
}

function isFormState(v: unknown): v is FormState {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as FormState).name === 'string' &&
    typeof (v as FormState).short === 'string'
  );
}
function loadDraft(): { form: FormState; step: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (typeof d !== 'object' || d === null) return null;
    const { form, step } = d as { form: unknown; step: unknown };
    if (!isFormState(form)) return null;
    return {
      form: { ...EMPTY_FORM, ...form },
      step: typeof step === 'number' ? Math.min(Math.max(step, 0), STEPS.length - 1) : 0,
    };
  } catch {
    return null;
  }
}
function saveDraft(form: FormState, step: number) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, savedAt: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
const isDirty = (f: FormState) =>
  (Object.keys(EMPTY_FORM) as FieldKey[]).some((k) => JSON.stringify(f[k]) !== JSON.stringify(EMPTY_FORM[k]));

function toInput({ terms: _terms, ...input }: FormState): SubmissionInput {
  return {
    ...input,
    name: input.name.trim(),
    short: input.short.trim(),
    version: input.version.trim(),
    repo: input.repo.trim(),
    description: input.description.trim(),
  };
}
function fromSubmission(s: Submission): FormState {
  return {
    name: s.name,
    type: s.type,
    category: s.category,
    short: s.short,
    version: s.version,
    minPlatform: s.minPlatform,
    file: s.file,
    license: s.license,
    repo: s.repo,
    description: s.description,
    terms: false,
  };
}

function stepClass(index: number, current: number): string {
  if (index === current) return 'active';
  return index < current ? 'done' : '';
}

function primaryLabel(isLastStep: boolean, submitting: boolean, editing: boolean): string {
  if (!isLastStep) return 'Next';
  if (submitting) return 'Submitting…';
  return editing ? 'Save changes' : 'Submit';
}

/** Label + control + inline error, wired up for screen readers. */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {(hint || error) && (
        <div className="field-meta">
          {error ? (
            <span className="field-error" id={`${id}-error`}>
              {error}
            </span>
          ) : (
            <span />
          )}
          {hint}
        </div>
      )}
    </div>
  );
}

export default function Submit() {
  const [params] = useSearchParams();
  const editId = params.get('edit') ? Number(params.get('edit')) : null;
  const { submissions, submitComponent, updateSubmission, notify } = useStore();
  const { isNameTaken } = useCatalog();
  const editing = editId !== null ? (submissions.find((s) => s.id === editId) ?? null) : null;

  // Initial state: the submission being edited, a saved draft, or an empty form.
  const [initial] = useState(() => {
    if (editId !== null) {
      const s = submissions.find((x) => x.id === editId);
      return { form: s ? fromSubmission(s) : EMPTY_FORM, step: 0, restored: false };
    }
    const draft = loadDraft();
    return draft && isDirty(draft.form) ? { ...draft, restored: true } : { form: EMPTY_FORM, step: 0, restored: false };
  });
  const [form, setForm] = useState<FormState>(initial.form);
  const [step, setStep] = useState(initial.step);
  const [attempted, setAttempted] = useState<boolean[]>(() => STEPS.map((_, i) => i < initial.step));
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Submission | null>(null);
  const submittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validate(form, (n) => isNameTaken(n, editId ?? undefined), editId !== null);
  const fieldStep = (k: FieldKey) => STEP_FIELDS.findIndex((fields) => fields.includes(k));
  const showError = (k: FieldKey) => (touched[k] || attempted[fieldStep(k)] ? errors[k] : undefined);
  const stepErrors = (s: number) => STEP_FIELDS[s].filter((k) => errors[k]);

  useEffect(() => {
    if (initial.restored) notify('Draft restored');
  }, [initial.restored, notify]);

  // Autosave the draft (new submissions only).
  useEffect(() => {
    if (editId !== null || done) return;
    if (isDirty(form)) saveDraft(form, step);
    else clearDraft();
  }, [form, step, editId, done]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const set = (k: FieldKey) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    let value: FormState[FieldKey];
    if (target instanceof HTMLInputElement && target.type === 'checkbox') value = target.checked;
    else if (target instanceof HTMLInputElement && target.type === 'file') {
      const f = target.files?.[0];
      value = f ? ({ name: f.name, size: f.size } satisfies PackageFile) : form.file;
      setTouched((t) => ({ ...t, file: true }));
    } else value = target.value;
    setForm((prev) => ({ ...prev, [k]: value }));
  };
  const blur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Props that connect a control to its label, error and hint.
  const a11y = (k: FieldKey, extraDescribedBy?: string) => {
    const err = showError(k);
    const describedBy = [err ? `f-${k}-error` : '', extraDescribedBy ?? ''].filter(Boolean).join(' ') || undefined;
    return { id: `f-${k}`, 'aria-invalid': err ? true : undefined, 'aria-describedby': describedBy, onBlur: blur(k) };
  };

  const focusFirstError = (s: number) => {
    const first = stepErrors(s)[0];
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#f-${first}`)?.focus());
  };

  const goTo = (s: number) => {
    setStep(s);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus());
  };

  const finalSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    timerRef.current = setTimeout(() => {
      const input = toInput(form);
      const result = editId !== null ? updateSubmission(editId, input) : submitComponent(input);
      submittingRef.current = false;
      setSubmitting(false);
      if (!result) {
        notify('This submission can no longer be edited.');
        return;
      }
      if (editId === null) clearDraft();
      setDone(result);
    }, SUBMIT_DELAY_MS);
  };

  const onNext = (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setAttempted((a) => a.map((v, i) => (i === step ? true : v)));
    if (stepErrors(step).length) {
      focusFirstError(step);
      return;
    }
    if (step < STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    // Final step: make sure every earlier step is still valid.
    const bad = STEPS.findIndex((_, i) => stepErrors(i).length > 0);
    if (bad !== -1) {
      setAttempted((a) => a.map((v, i) => (i <= bad ? true : v)));
      setStep(bad);
      focusFirstError(bad);
      return;
    }
    finalSubmit();
  };

  const discardDraft = () => {
    clearDraft();
    setForm(EMPTY_FORM);
    setStep(0);
    setAttempted(STEPS.map(() => false));
    setTouched({});
    notify('Draft discarded');
  };

  const startOver = () => {
    setDone(null);
    setForm(EMPTY_FORM);
    setStep(0);
    setAttempted(STEPS.map(() => false));
    setTouched({});
  };

  if (editId !== null && (!editing || (editing.status !== 'pending' && !done))) {
    return (
      <div className="container page narrow center">
        <h1>Submission can't be edited</h1>
        <p className="muted">Only submissions that are still pending review can be edited.</p>
        <Link to="/my?tab=submissions" className="btn btn-primary">
          Go to My submissions
        </Link>
      </div>
    );
  }

  if (done) {
    const seconds = Math.round(getAutoPublishMs() / 1000);
    const wait = seconds < 120 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`;
    return (
      <div className="container page narrow center submit-done">
        <div className="empty-icon" aria-hidden="true">
          🎉
        </div>
        <h1>{editId !== null ? 'Submission updated' : 'Submission received'}</h1>
        <p className="muted">
          <b>{done.name}</b> v{done.version} is pending review. In this demo it is approved and published automatically
          in about {wait}.
        </p>
        <div className="row-center">
          <Link to={`/components/${done.slug}`} className="btn btn-primary">
            View component
          </Link>
          <Link to="/my?tab=submissions" className="btn btn-secondary">
            My submissions
          </Link>
          {editId === null && (
            <button className="btn btn-secondary" onClick={startOver}>
              Submit another
            </button>
          )}
        </div>
      </div>
    );
  }

  const shortLen = form.short.trim().length;
  const reviewRows: [string, ReactNode][][] = [
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

  return (
    <div className="container page narrow">
      <div className="form-title">
        <h1>{editId !== null ? 'Edit submission' : 'Contribute a component'}</h1>
        {editId === null && isDirty(form) && (
          <button type="button" className="text-btn link" onClick={discardDraft}>
            Discard draft
          </button>
        )}
      </div>
      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={stepClass(i, step)} aria-current={i === step ? 'step' : undefined}>
            <span aria-hidden="true">{i < step ? '✓' : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <form
        ref={formRef}
        className="side-card form"
        onSubmit={onNext}
        noValidate
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      >
        {step === 0 && (
          <>
            <Field id="f-name" label="Name" error={showError('name')}>
              <input
                {...a11y('name')}
                value={form.name}
                onChange={set('name')}
                placeholder="My Awesome Widget"
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <div className="row-gap">
              <Field id="f-type" label="Type">
                <select {...a11y('type')} value={form.type} onChange={set('type')}>
                  {TYPES.map((t: ComponentType) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field id="f-category" label="Category">
                <select {...a11y('category')} value={form.category} onChange={set('category')}>
                  {CATEGORIES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              id="f-short"
              label="Short description"
              error={showError('short')}
              hint={
                <span id="f-short-count" className={`char-count ${shortLen > SHORT_MAX ? 'over' : ''}`}>
                  {shortLen}/{SHORT_MAX}
                </span>
              }
            >
              <input
                {...a11y('short', 'f-short-count')}
                value={form.short}
                onChange={set('short')}
                maxLength={200}
                placeholder="One sentence shown on the card"
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="row-gap">
              <Field id="f-version" label="Version" error={showError('version')}>
                <input {...a11y('version')} value={form.version} onChange={set('version')} placeholder="1.0.0" />
              </Field>
              <Field id="f-minPlatform" label="Minimum platform version">
                <select {...a11y('minPlatform')} value={form.minPlatform} onChange={set('minPlatform')}>
                  {PLATFORM_VERSIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              id="f-file"
              label="Package file (.mpk or .zip, max 50 MB)"
              error={showError('file')}
              hint={
                form.file ? (
                  <span id="f-file-meta" className="muted small">
                    Selected: {form.file.name} ({formatBytes(form.file.size)})
                  </span>
                ) : undefined
              }
            >
              <input
                {...a11y('file', form.file ? 'f-file-meta' : undefined)}
                type="file"
                accept=".mpk,.zip"
                onChange={set('file')}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field id="f-license" label="License">
              <select {...a11y('license')} value={form.license} onChange={set('license')}>
                {LICENSE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="f-repo" label="Source repository (optional)" error={showError('repo')}>
              <input
                {...a11y('repo')}
                type="url"
                inputMode="url"
                value={form.repo}
                onChange={set('repo')}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field id="f-description" label="Full description (optional)">
              <textarea
                {...a11y('description')}
                rows={6}
                value={form.description}
                onChange={set('description')}
                placeholder="What does it do, how do you configure it, any limitations?"
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            {reviewRows.map((rows, s) => (
              <section key={STEPS[s]} className="review-section">
                <div className="review-section-head">
                  <h2>{STEPS[s]}</h2>
                  <button
                    type="button"
                    className="text-btn link"
                    onClick={() => goTo(s)}
                    aria-label={`Edit ${STEPS[s]}`}
                  >
                    Edit
                  </button>
                </div>
                <dl className="facts">
                  {rows.map(([k, v]) => (
                    <Fragment key={k}>
                      <dt>{k}</dt>
                      <dd>{v || '—'}</dd>
                    </Fragment>
                  ))}
                </dl>
              </section>
            ))}
            <div className={`field ${showError('terms') ? 'has-error' : ''}`}>
              <label className="check">
                <input type="checkbox" {...a11y('terms')} checked={form.terms} onChange={set('terms')} />
                <span className="check-label">
                  I agree to the <Link to="/guidelines">publishing guidelines</Link>
                </span>
              </label>
              {showError('terms') && (
                <div className="field-meta">
                  <span className="field-error" id="f-terms-error">
                    {showError('terms')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* preventDefault on mousedown keeps focus in the current field, so its blur-triggered
            error can't shift these buttons mid-click and swallow the click. */}
        <div className="row-end">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goTo(step - 1)}
              disabled={submitting}
            >
              Back
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            onMouseDown={(e) => e.preventDefault()}
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            {primaryLabel(step === STEPS.length - 1, submitting, editId !== null)}
          </button>
        </div>
      </form>
    </div>
  );
}
