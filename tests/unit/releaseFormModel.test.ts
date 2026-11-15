import { describe, expect, it } from 'vitest';
import type { StudioRelease } from '../../shared/studio';
import {
  formToReleaseBody,
  itemErrorKey,
  mapServerErrors,
  releaseToForm,
  saveButtonLabel,
  sectionErrorKey,
  validateReleaseForm,
  type ReleaseFormState,
} from '../../src/features/studio/releaseFormModel';

const counter = () => {
  let n = 0;
  return () => ++n;
};
const FORM: ReleaseFormState = {
  version: '11.20.0',
  type: '',
  date: '2026-01-15',
  mac: true,
  macTouched: false,
  sections: [{ id: 1, name: 'Fixes', items: [{ id: 2, text: 'Fixed a thing.' }] }],
};
const withSections = (sections: ReleaseFormState['sections']) => ({ ...FORM, sections });

describe('validateReleaseForm', () => {
  it('accepts a valid release', () => {
    expect(validateReleaseForm(FORM, true)).toEqual({});
  });

  it.each([
    ['bad version (create)', { version: '11.20' }, true, 'version'],
    ['version not checked when editing', { version: 'whatever' }, false, null],
    ['unreal date', { date: '2026-02-30' }, true, 'date'],
    ['future date', { date: '2999-01-01' }, true, 'date'],
    ['Mac below Studio 10', { version: '9.24.1', mac: true }, true, 'mac'],
  ])('%s', (_case, patch, creating, field) => {
    const errors = validateReleaseForm({ ...FORM, ...patch }, creating);
    if (field) expect(errors[field]).toBeTruthy();
    else expect(errors).toEqual({});
  });

  it('checks section names: required, unique (case-insensitive), max length', () => {
    const errors = validateReleaseForm(
      withSections([
        { id: 1, name: '', items: [{ id: 2, text: 'a' }] },
        { id: 3, name: 'Fixes', items: [{ id: 4, text: 'b' }] },
        { id: 5, name: 'fixes', items: [{ id: 6, text: 'c' }] },
        { id: 7, name: 'x'.repeat(61), items: [{ id: 8, text: 'd' }] },
      ]),
      true,
    );
    expect(errors[sectionErrorKey(0)]).toContain('required');
    expect(errors[sectionErrorKey(1)]).toBeUndefined();
    expect(errors[sectionErrorKey(2)]).toContain('unique');
    expect(errors[sectionErrorKey(3)]).toContain('60');
  });

  it('checks items: not empty, at most 300 characters, at least one per section', () => {
    const errors = validateReleaseForm(
      withSections([
        { id: 1, name: 'A', items: [{ id: 2, text: '  ' }, { id: 3, text: 'y'.repeat(301) }] },
        { id: 4, name: 'B', items: [] },
      ]),
      true,
    );
    expect(errors[itemErrorKey(0, 0)]).toContain('empty');
    expect(errors[itemErrorKey(0, 1)]).toContain('300');
    expect(errors[sectionErrorKey(1)]).toContain('at least one item');
  });

  it('allows at most 5 sections', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: i, name: `S${i}`, items: [{ id: 100 + i, text: 'x' }] }));
    expect(validateReleaseForm(withSections(six), true).notes).toContain('5');
  });
});

describe('mapServerErrors', () => {
  it('maps field and notes paths onto form keys', () => {
    const form = withSections([{ id: 1, name: 'Fixes', items: [{ id: 2, text: 'a' }, { id: 3, text: 'b' }] }]);
    const result = mapServerErrors(
      {
        status: 422,
        message: 'The request body is invalid.',
        details: [
          { field: 'date', message: 'bad date' },
          { field: 'notes.Fixes.1', message: 'bad item' },
          { field: 'notes.Fixes', message: 'bad section' },
          { field: 'notes', message: 'too many sections' },
        ],
      },
      form,
    );
    expect(result.fields).toEqual({
      date: 'bad date',
      [itemErrorKey(0, 1)]: 'bad item',
      [sectionErrorKey(0)]: 'bad section',
      notes: 'too many sections',
    });
    expect(result.form).toBeNull();
  });

  it('falls back to a form-level message for unknown fields or non-422 errors', () => {
    const unknown = mapServerErrors(
      { status: 422, message: 'Invalid.', details: [{ field: '(body)', message: 'Unknown field: major' }] },
      FORM,
    );
    expect(unknown.form).toBe('Invalid. Unknown field: major');

    const conflict = mapServerErrors(
      { status: 409, message: 'Release 11.20.0 already exists.', details: [{ field: 'version', message: 'exists' }] },
      FORM,
    );
    expect(conflict.form).toBe('Release 11.20.0 already exists.');
  });

  it('maps a notes path for a section that no longer exists to the notes field', () => {
    expect(mapServerErrors({ status: 422, message: 'x', details: [{ field: 'notes.Gone.0', message: 'm' }] }, FORM).fields).toEqual({
      notes: 'm',
    });
  });
});

describe('form <-> release', () => {
  const release: StudioRelease = {
    version: '11.16.0',
    major: 11,
    minor: 16,
    patch: 0,
    line: '11.16',
    type: null,
    date: '2026-09-26',
    mac: true,
    notes: { 'New Features': ['One', 'Two'], Fixes: ['Three'] },
  };

  it('builds a form from a release with unique ids', () => {
    const form = releaseToForm(release, counter());
    expect(form.type).toBe('');
    expect(form.macTouched).toBe(true);
    expect(form.sections.map((s) => s.name)).toEqual(['New Features', 'Fixes']);
    const ids = form.sections.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts a new release empty, dated today', () => {
    const form = releaseToForm(null, counter());
    expect(form).toMatchObject({ version: '', type: '', mac: false, macTouched: false, sections: [] });
    expect(form.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('turns the form into a trimmed request body', () => {
    const body = formToReleaseBody({
      ...FORM,
      type: 'LTS',
      sections: [{ id: 1, name: '  Fixes ', items: [{ id: 2, text: '  done  ' }] }],
    });
    expect(body).toEqual({ type: 'LTS', date: FORM.date, mac: true, notes: { Fixes: ['done'] } });
    expect(formToReleaseBody(FORM).type).toBeNull();
  });

  it.each([
    [true, true, 'Saving…'],
    [false, true, 'Create release'],
    [false, false, 'Save changes'],
  ])('save button label (saving=%s, creating=%s)', (saving, creating, label) => {
    expect(saveButtonLabel(saving, creating)).toBe(label);
  });
});
