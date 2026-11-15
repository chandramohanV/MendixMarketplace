import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotify, useSubmissions } from '../../store/contexts';
import { useCatalog } from '../../store/useCatalog';
import type { Submission } from '../../types';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { DetailsStep, GeneralStep, PackageStep } from './FormSteps';
import { ReviewStep } from './ReviewStep';
import { controlId, type ControlElement, type ControlProps, type StepProps } from './stepProps';
import { CannotEditNotice, SubmitStepper, SubmitSuccess } from './SubmitScreens';
import {
  EMPTY_FORM,
  fieldsWithErrors,
  formFromSubmission,
  isDirty,
  primaryButtonLabel,
  STEPS,
  stepOfField,
  toSubmissionInput,
  validateSubmission,
  type FieldKey,
  type FormState,
} from './submitForm';

/** Short pause so the "Submitting…" state is visible (the demo saves instantly). */
const SUBMIT_DELAY_MS = 600;
const LAST_STEP = STEPS.length - 1;
const FORM_STEPS = [GeneralStep, PackageStep, DetailsStep];

function useInitialFormState(editId: number | null, submissions: Submission[]) {
  // Read once: the submission being edited, a saved draft, or an empty form.
  const [initial] = useState(() => {
    if (editId !== null) {
      const s = submissions.find((x) => x.id === editId);
      return { form: s ? formFromSubmission(s) : EMPTY_FORM, step: 0, wasRestored: false };
    }
    const draft = loadDraft();
    return draft && isDirty(draft.form)
      ? { ...draft, wasRestored: true }
      : { form: EMPTY_FORM, step: 0, wasRestored: false };
  });
  return initial;
}

export default function SubmitPage() {
  const [params] = useSearchParams();
  const editId = params.get('edit') ? Number(params.get('edit')) : null;
  const isEdit = editId !== null;
  const { submissions, submitComponent, updateSubmission } = useSubmissions();
  const notify = useNotify();
  const { isNameTaken } = useCatalog();
  const editing = isEdit ? (submissions.find((s) => s.id === editId) ?? null) : null;

  const initial = useInitialFormState(editId, submissions);
  const [form, setForm] = useState<FormState>(initial.form);
  const [step, setStep] = useState(initial.step);
  const [attemptedSteps, setAttemptedSteps] = useState<boolean[]>(() => STEPS.map((_, i) => i < initial.step));
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState<Submission | null>(null);
  const isSubmittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validateSubmission(form, (name) => isNameTaken(name, editId ?? undefined), isEdit);
  const errorFor = (key: FieldKey) => (touched[key] || attemptedSteps[stepOfField(key)] ? errors[key] : undefined);

  useEffect(() => {
    if (initial.wasRestored) notify('Draft restored');
  }, [initial.wasRestored, notify]);

  // Autosave the draft (new submissions only).
  useEffect(() => {
    if (isEdit || done) return;
    if (isDirty(form)) saveDraft({ form, step });
    else clearDraft();
  }, [form, step, isEdit, done]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const onChange = (key: FieldKey) => (e: ChangeEvent<ControlElement>) => {
    const target = e.target;
    let value: FormState[FieldKey];
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      value = target.checked;
    } else if (target instanceof HTMLInputElement && target.type === 'file') {
      const file = target.files?.[0];
      value = file ? { name: file.name, size: file.size } : form.file;
      setTouched((t) => ({ ...t, file: true }));
    } else {
      value = target.value;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const controlProps = (key: FieldKey, extraDescribedBy?: string): ControlProps => {
    const error = errorFor(key);
    const describedBy = [error ? `${controlId(key)}-error` : '', extraDescribedBy ?? ''].filter(Boolean).join(' ');
    return {
      id: controlId(key),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy || undefined,
      onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    };
  };

  const focusFirstError = (s: number) => {
    const first = fieldsWithErrors(s, errors)[0];
    if (first)
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${controlId(first)}`)?.focus());
  };

  const goToStep = (s: number) => {
    setStep(s);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus());
  };

  const markAttempted = (upTo: number, onlyThis = false) =>
    setAttemptedSteps((a) => a.map((v, i) => (onlyThis ? i === upTo : i <= upTo) || v));

  const finalSubmit = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    timerRef.current = setTimeout(() => {
      const input = toSubmissionInput(form);
      const result = isEdit ? updateSubmission(editId, input) : submitComponent(input);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      if (!result) {
        notify('This submission can no longer be edited.');
        return;
      }
      if (!isEdit) clearDraft();
      setDone(result);
    }, SUBMIT_DELAY_MS);
  };

  const onNext = (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    markAttempted(step, true);
    if (fieldsWithErrors(step, errors).length) {
      focusFirstError(step);
      return;
    }
    if (step < LAST_STEP) {
      goToStep(step + 1);
      return;
    }
    // Final step: make sure every earlier step is still valid.
    const firstInvalid = STEPS.findIndex((_, i) => fieldsWithErrors(i, errors).length > 0);
    if (firstInvalid !== -1) {
      markAttempted(firstInvalid);
      setStep(firstInvalid);
      focusFirstError(firstInvalid);
      return;
    }
    finalSubmit();
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setStep(0);
    setAttemptedSteps(STEPS.map(() => false));
    setTouched({});
  };
  const discardDraft = () => {
    clearDraft();
    resetForm();
    notify('Draft discarded');
  };
  const startOver = () => {
    setDone(null);
    resetForm();
  };

  if (isEdit && (!editing || (editing.status !== 'pending' && !done))) return <CannotEditNotice />;
  if (done) return <SubmitSuccess submission={done} isEdit={isEdit} onSubmitAnother={startOver} />;

  const stepProps: StepProps = { form, onChange, controlProps, errorFor };
  const CurrentStep = FORM_STEPS[step];

  return (
    <div className="container page narrow">
      <div className="form-title">
        <h1>{isEdit ? 'Edit submission' : 'Contribute a component'}</h1>
        {!isEdit && isDirty(form) && (
          <button type="button" className="text-btn link" onClick={discardDraft}>
            Discard draft
          </button>
        )}
      </div>
      <SubmitStepper step={step} />

      <form
        ref={formRef}
        className="side-card form"
        onSubmit={onNext}
        noValidate
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      >
        {step === LAST_STEP ? <ReviewStep {...stepProps} onEditStep={goToStep} /> : <CurrentStep {...stepProps} />}

        {/* preventDefault on mousedown keeps focus in the current field, so its blur-triggered
            error can't shift these buttons mid-click and swallow the click. */}
        <div className="row-end">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goToStep(step - 1)}
              disabled={isSubmitting}
            >
              Back
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            onMouseDown={(e) => e.preventDefault()}
            disabled={isSubmitting}
            aria-busy={isSubmitting || undefined}
          >
            {primaryButtonLabel(step === LAST_STEP, isSubmitting, isEdit)}
          </button>
        </div>
      </form>
    </div>
  );
}
