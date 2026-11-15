import { useRef, useState, type FormEvent } from 'react';
import { Field } from '../../components/Field';
import {
  defaultMac,
  RELEASE_TYPE_VALUES,
  todayISO,
  VERSION_RE,
  type ReleaseType,
  type StudioRelease,
} from '../../../shared/studio';
import { ApiError, createRelease, updateRelease } from './api';
import { NotesEditor } from './NotesEditor';
import {
  formToReleaseBody,
  mapServerErrors,
  releaseToForm,
  saveButtonLabel,
  validateReleaseForm,
  type NoteSectionState,
  type ReleaseFormErrors,
  type ReleaseFormState,
} from './releaseFormModel';
import type { ReleaseControlProps } from './releaseFormProps';

/** Create (initial = null) or edit a release. Server 422 details are shown on the matching fields. */
export function ReleaseForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: StudioRelease | null;
  onCancel: () => void;
  onSaved: (release: StudioRelease, created: boolean) => void;
}) {
  const isCreating = initial === null;
  // Keys for note sections/items: a per-form counter, created once, so nothing is shared between forms.
  const [nextId] = useState(() => {
    let lastId = 0;
    return () => ++lastId;
  });
  const [form, setForm] = useState<ReleaseFormState>(() => releaseToForm(initial, nextId));
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<ReleaseFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const clientErrors = validateReleaseForm(form, isCreating);
  const errorFor = (key: string) => serverErrors[key] ?? (attempted || touched[key] ? clientErrors[key] : undefined);
  const controlProps = (key: string): ReleaseControlProps => ({
    id: `rf-${key}`,
    'aria-invalid': errorFor(key) ? true : undefined,
    'aria-describedby': errorFor(key) ? `rf-${key}-error` : undefined,
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
  });

  // Any edit clears the server's verdict on the previous attempt.
  const update = (change: (f: ReleaseFormState) => ReleaseFormState) => {
    setForm(change);
    setServerErrors({});
    setFormError(null);
  };
  const updateSections = (change: (sections: NoteSectionState[]) => NoteSectionState[]) =>
    update((f) => ({ ...f, sections: change(f.sections) }));

  const focusFirstInvalid = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setAttempted(true);
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid();
      return;
    }
    const body = formToReleaseBody(form);
    setIsSaving(true);
    try {
      const saved = isCreating
        ? await createRelease({ version: form.version.trim(), ...body })
        : await updateRelease(initial.version, body);
      onSaved(saved, isCreating);
    } catch (err) {
      const failure = err instanceof ApiError ? err : new ApiError(0, 'unknown', 'Something went wrong.');
      if (failure.status === 409) {
        // A duplicate version (or LATEST conflict) is a form-level message.
        setFormError(failure.message);
        setServerErrors({});
      } else {
        const mapped = mapServerErrors(failure, form);
        setServerErrors(mapped.fields);
        setFormError(mapped.form);
      }
      setIsSaving(false);
      focusFirstInvalid();
    }
  };

  const isWindowsOnly = VERSION_RE.test(form.version.trim()) && !defaultMac(form.version.trim());
  const macError = errorFor('mac');

  return (
    <form ref={formRef} className="form release-form" onSubmit={submit} noValidate>
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}
      <div className="row-gap">
        <Field
          id="rf-version"
          label="Version"
          error={errorFor('version')}
          hint={isCreating ? 'For example 11.17.1' : 'The version cannot be changed.'}
        >
          <input
            {...controlProps('version')}
            value={form.version}
            readOnly={!isCreating}
            placeholder="11.17.1"
            autoComplete="off"
            onChange={(e) => {
              const version = e.target.value;
              update((f) => ({ ...f, version, mac: f.macTouched ? f.mac : defaultMac(version.trim()) }));
            }}
          />
        </Field>
        <Field id="rf-type" label="Release type" error={errorFor('type')}>
          <select
            {...controlProps('type')}
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as ReleaseType | '';
              update((f) => ({ ...f, type }));
            }}
          >
            <option value="">None</option>
            {RELEASE_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row-gap">
        <Field id="rf-date" label="Release date" error={errorFor('date')}>
          <input
            {...controlProps('date')}
            type="date"
            max={todayISO()}
            value={form.date}
            onChange={(e) => {
              const date = e.target.value;
              update((f) => ({ ...f, date }));
            }}
          />
        </Field>
        <div className={`field ${macError ? 'has-error' : ''}`}>
          <span className="field-label">Downloads</span>
          <label className="check mac-check">
            <input
              type="checkbox"
              {...controlProps('mac')}
              checked={form.mac}
              onChange={(e) => {
                const mac = e.target.checked;
                update((f) => ({ ...f, mac, macTouched: true }));
              }}
            />
            <span className="check-label">Available for Mac (Beta)</span>
          </label>
          <div className="field-meta">
            {macError ? (
              <span className="field-error" id="rf-mac-error">
                {macError}
              </span>
            ) : (
              <span className="muted">
                {isWindowsOnly ? 'Studio 9 and earlier: Windows only.' : 'Windows is always available.'}
              </span>
            )}
          </div>
        </div>
      </div>

      <NotesEditor
        sections={form.sections}
        onChange={updateSections}
        nextId={nextId}
        errorFor={errorFor}
        controlProps={controlProps}
      />

      <div className="row-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving} aria-busy={isSaving || undefined}>
          {saveButtonLabel(isSaving, isCreating)}
        </button>
      </div>
    </form>
  );
}
