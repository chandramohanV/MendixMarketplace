import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  fieldsWithErrors,
  formFromSubmission,
  isDirty,
  LIMITS,
  primaryButtonLabel,
  STEP_FIELDS,
  stepOfField,
  toSubmissionInput,
  validateSubmission,
  type FormState,
} from '../../src/features/submit/submitForm';
import type { Submission } from '../../src/types';

const VALID: FormState = {
  ...EMPTY_FORM,
  name: 'Valid Widget',
  short: 'A perfectly valid short description.',
  version: '1.2.3',
  file: { name: 'widget.mpk', size: 2048 },
  repo: 'https://github.com/demo/widget',
  terms: true,
};
const neverTaken = () => false;
const errorsFor = (patch: Partial<FormState>, editing = false, isNameTaken = neverTaken) =>
  validateSubmission({ ...VALID, ...patch }, isNameTaken, editing);

describe('validateSubmission', () => {
  it('accepts a fully valid form', () => {
    expect(errorsFor({})).toEqual({});
  });

  it.each([
    ['too short', 'ab', true],
    ['minimum length', 'abc', false],
    ['maximum length', 'x'.repeat(LIMITS.nameMax), false],
    ['too long', 'x'.repeat(LIMITS.nameMax + 1), true],
    ['only spaces', '      ', true],
    ['trimmed before measuring', '  ab  ', true],
  ])('name: %s', (_case, name, hasError) => {
    expect(Boolean(errorsFor({ name }).name)).toBe(hasError);
  });

  it('rejects a name that is already taken, with a clear message', () => {
    const errors = errorsFor({ name: 'Excel Importer' }, false, (n) => n === 'Excel Importer');
    expect(errors.name).toContain('already exists');
  });

  it.each([
    ['9 characters', 'x'.repeat(9), true],
    ['10 characters', 'x'.repeat(10), false],
    ['160 characters', 'x'.repeat(160), false],
    ['161 characters', 'x'.repeat(161), true],
  ])('short description: %s', (_case, short, hasError) => {
    expect(Boolean(errorsFor({ short }).short)).toBe(hasError);
  });

  it.each([
    ['1.0.0', false],
    ['10.20.30', false],
    [' 1.0.0 ', false],
    ['1.0', true],
    ['1.0.0.0', true],
    ['v1.0.0', true],
    ['', true],
  ])('version %j', (version, hasError) => {
    expect(Boolean(errorsFor({ version }).version)).toBe(hasError);
  });

  it.each([
    ['missing (new submission)', null, false, 'Choose a package'],
    ['missing (editing keeps the old file)', null, true, undefined],
    ['wrong extension', { name: 'readme.txt', size: 10 }, false, '.mpk or .zip'],
    ['.ZIP in upper case', { name: 'PKG.ZIP', size: 10 }, false, undefined],
    ['exactly 50 MB', { name: 'big.mpk', size: LIMITS.fileBytes }, false, undefined],
    ['over 50 MB', { name: 'big.mpk', size: LIMITS.fileBytes + 1 }, false, '50 MB or smaller'],
  ])('package file: %s', (_case, file, editing, message) => {
    const error = errorsFor({ file }, editing).file;
    if (message) expect(error).toContain(message);
    else expect(error).toBeUndefined();
  });

  it.each([
    ['empty (optional)', '', false],
    ['https', 'https://example.com/repo', false],
    ['http', 'http://example.com/repo', true],
    ['not a URL', 'not a url', true],
    ['ftp', 'ftp://example.com', true],
  ])('repository: %s', (_case, repo, hasError) => {
    expect(Boolean(errorsFor({ repo }).repo)).toBe(hasError);
  });

  it('requires the terms checkbox', () => {
    expect(errorsFor({ terms: false }).terms).toContain('publishing guidelines');
  });
});

describe('step helpers', () => {
  it('maps every field to exactly one step', () => {
    const all = STEP_FIELDS.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(stepOfField('name')).toBe(0);
    expect(stepOfField('file')).toBe(1);
    expect(stepOfField('repo')).toBe(2);
    expect(stepOfField('terms')).toBe(3);
  });

  it('lists the fields with errors for a step, in form order', () => {
    const errors = validateSubmission({ ...EMPTY_FORM }, neverTaken, false);
    expect(fieldsWithErrors(0, errors)).toEqual(['name', 'short']);
    expect(fieldsWithErrors(1, errors)).toEqual(['file']);
  });

  it.each([
    [false, false, false, 'Next'],
    [true, true, false, 'Submitting…'],
    [true, false, true, 'Save changes'],
    [true, false, false, 'Submit'],
  ])('primary button label (last=%s, submitting=%s, editing=%s)', (last, submitting, editing, label) => {
    expect(primaryButtonLabel(last, submitting, editing)).toBe(label);
  });
});

describe('form mapping', () => {
  it('treats only changed forms as dirty', () => {
    expect(isDirty(EMPTY_FORM)).toBe(false);
    expect(isDirty({ ...EMPTY_FORM, name: 'x' })).toBe(true);
    expect(isDirty({ ...EMPTY_FORM, file: { name: 'a.mpk', size: 1 } })).toBe(true);
  });

  it('trims values and drops the terms flag when saving', () => {
    const input = toSubmissionInput({ ...VALID, name: '  Spaced  ', short: ' s '.repeat(5), repo: ' https://x.io ' });
    expect(input.name).toBe('Spaced');
    expect(input.repo).toBe('https://x.io');
    expect('terms' in input).toBe(false);
  });

  it('round-trips a submission into the form (terms unchecked)', () => {
    const submission: Submission = {
      ...toSubmissionInput(VALID),
      id: 1000001,
      slug: '1000001-valid-widget',
      status: 'pending',
      submittedAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      publishAt: null,
    };
    expect(formFromSubmission(submission)).toEqual({ ...toSubmissionInput(VALID), terms: false });
  });
});
