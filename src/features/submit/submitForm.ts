// Submit form model and validation. Pure: no React, no storage.
import { CATEGORIES, LICENSE_TYPES, PLATFORM_VERSIONS, TYPES } from '../../data/components';
import { formatBytes } from '../../lib/format';
import type { Submission, SubmissionInput } from '../../types';

export const STEPS = ['General', 'Package', 'Details', 'Review'] as const;
export const LIMITS = {
  nameMin: 3,
  nameMax: 60,
  shortMin: 10,
  shortMax: 160,
  fileBytes: 50 * 1024 * 1024,
} as const;

export interface FormState extends SubmissionInput {
  terms: boolean;
}
export type FieldKey = keyof FormState;
export type FormErrors = Partial<Record<FieldKey, string>>;

/** Which fields each step owns (errors are shown and checked per step). */
export const STEP_FIELDS: FieldKey[][] = [
  ['name', 'type', 'category', 'short'],
  ['version', 'minPlatform', 'file'],
  ['license', 'repo', 'description'],
  ['terms'],
];

export const EMPTY_FORM: FormState = {
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

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates the whole form. `editing` relaxes the package rule: an edit may keep the file that was
 * uploaded before.
 */
export function validateSubmission(
  form: FormState,
  isNameTaken: (name: string) => boolean,
  editing: boolean,
): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors.name = `Name must be ${LIMITS.nameMin}–${LIMITS.nameMax} characters.`;
  } else if (isNameTaken(name)) {
    errors.name = `A component named “${name}” already exists. Choose a different name.`;
  }

  const shortLength = form.short.trim().length;
  if (shortLength < LIMITS.shortMin || shortLength > LIMITS.shortMax) {
    errors.short = `Short description must be ${LIMITS.shortMin}–${LIMITS.shortMax} characters.`;
  }

  if (!/^\d+\.\d+\.\d+$/.test(form.version.trim())) errors.version = 'Use semantic versioning, for example 1.0.0.';

  if (!form.file) {
    if (!editing) errors.file = 'Choose a package file (.mpk or .zip).';
  } else if (!/\.(mpk|zip)$/i.test(form.file.name)) {
    errors.file = 'Package must be a .mpk or .zip file.';
  } else if (form.file.size > LIMITS.fileBytes) {
    errors.file = `Package must be 50 MB or smaller (this file is ${formatBytes(form.file.size)}).`;
  }

  if (form.repo.trim() && !isHttpsUrl(form.repo.trim()))
    errors.repo = 'Repository URL must be a valid https:// address.';
  if (!form.terms) errors.terms = 'You must accept the publishing guidelines.';
  return errors;
}

export const stepOfField = (key: FieldKey): number => STEP_FIELDS.findIndex((fields) => fields.includes(key));
export const fieldsWithErrors = (step: number, errors: FormErrors): FieldKey[] =>
  STEP_FIELDS[step].filter((key) => errors[key]);

/** True when the form differs from a fresh one (used to decide whether a draft is worth keeping). */
export const isDirty = (form: FormState): boolean =>
  (Object.keys(EMPTY_FORM) as FieldKey[]).some((key) => JSON.stringify(form[key]) !== JSON.stringify(EMPTY_FORM[key]));

/** The values that get saved: trimmed, without the terms checkbox. */
export function toSubmissionInput({ terms: _terms, ...input }: FormState): SubmissionInput {
  return {
    ...input,
    name: input.name.trim(),
    short: input.short.trim(),
    version: input.version.trim(),
    repo: input.repo.trim(),
    description: input.description.trim(),
  };
}

export function formFromSubmission(s: Submission): FormState {
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

export function primaryButtonLabel(isLastStep: boolean, isSubmitting: boolean, isEditing: boolean): string {
  if (!isLastStep) return 'Next';
  if (isSubmitting) return 'Submitting…';
  return isEditing ? 'Save changes' : 'Submit';
}
