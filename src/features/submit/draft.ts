// Draft autosave for new submissions, stored in localStorage.
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { EMPTY_FORM, STEPS, type FormState } from './submitForm';

export interface Draft {
  form: FormState;
  step: number;
}

const looksLikeForm = (v: unknown): v is Partial<FormState> =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as FormState).name === 'string' &&
  typeof (v as FormState).short === 'string';

const clampStep = (step: unknown): number =>
  typeof step === 'number' ? Math.min(Math.max(step, 0), STEPS.length - 1) : 0;

/** Returns the saved draft, or null if there is none or it can't be read. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.submitDraft);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) return null;
    const { form, step } = saved as { form: unknown; step: unknown };
    if (!looksLikeForm(form)) return null;
    return { form: { ...EMPTY_FORM, ...form }, step: clampStep(step) };
  } catch {
    return null;
  }
}

export function saveDraft({ form, step }: Draft): void {
  try {
    localStorage.setItem(STORAGE_KEYS.submitDraft, JSON.stringify({ form, step, savedAt: new Date().toISOString() }));
  } catch {
    // Storage unavailable: the draft just isn't kept.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.submitDraft);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
