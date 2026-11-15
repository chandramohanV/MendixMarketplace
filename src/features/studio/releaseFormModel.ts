// Release form model, validation and server-error mapping. Pure: no React, no network.
import {
  isRealDate,
  LIMITS,
  macRuleError,
  todayISO,
  VERSION_RE,
  type FieldError,
  type ReleaseType,
  type StudioRelease,
} from '../../../shared/studio';

export interface NoteItemState {
  id: number;
  text: string;
}
export interface NoteSectionState {
  id: number;
  name: string;
  items: NoteItemState[];
}
export interface ReleaseFormState {
  version: string;
  type: ReleaseType | '';
  date: string;
  mac: boolean;
  /** Once the user sets Mac by hand, it stops following the version's default. */
  macTouched: boolean;
  sections: NoteSectionState[];
}
/** Errors keyed by field: version, type, date, mac, notes, or a section/item key below. */
export type ReleaseFormErrors = Record<string, string>;

export const sectionErrorKey = (section: number): string => `section-${section}-name`;
export const itemErrorKey = (section: number, item: number): string => `section-${section}-item-${item}`;

/** A form for `release`, or an empty one for a new release. `nextId` gives React keys to sections/items. */
export function releaseToForm(release: StudioRelease | null, nextId: () => number): ReleaseFormState {
  if (!release) return { version: '', type: '', date: todayISO(), mac: false, macTouched: false, sections: [] };
  return {
    version: release.version,
    type: release.type ?? '',
    date: release.date,
    mac: release.mac,
    macTouched: true,
    sections: Object.entries(release.notes).map(([name, items]) => ({
      id: nextId(),
      name,
      items: items.map((text) => ({ id: nextId(), text })),
    })),
  };
}

function validateSection(section: NoteSectionState, index: number, seen: Set<string>, errors: ReleaseFormErrors): void {
  const key = sectionErrorKey(index);
  const name = section.name.trim();
  if (!name) errors[key] = 'Section name is required.';
  else if (name.length > LIMITS.sectionNameLength) errors[key] = `At most ${LIMITS.sectionNameLength} characters.`;
  else if (seen.has(name.toLowerCase())) errors[key] = 'Section names must be unique.';
  seen.add(name.toLowerCase());
  if (section.items.length === 0) errors[key] ??= 'Add at least one item or remove the section.';
  if (section.items.length > LIMITS.itemsPerSection)
    errors[key] ??= `At most ${LIMITS.itemsPerSection} items per section.`;
  section.items.forEach((item, j) => {
    const text = item.text.trim();
    if (!text) errors[itemErrorKey(index, j)] = 'Note items cannot be empty.';
    else if (text.length > LIMITS.itemLength) {
      errors[itemErrorKey(index, j)] = `At most ${LIMITS.itemLength} characters (${text.length}).`;
    }
  });
}

/** Client-side checks; the server enforces the same rules (and more, like unique versions). */
export function validateReleaseForm(form: ReleaseFormState, isCreating: boolean): ReleaseFormErrors {
  const errors: ReleaseFormErrors = {};
  if (isCreating && !VERSION_RE.test(form.version.trim()))
    errors.version = 'Use semantic versioning, for example 11.2.0.';
  if (!isRealDate(form.date)) errors.date = 'Enter a real date.';
  else if (form.date > todayISO()) errors.date = 'Release date cannot be in the future.';
  const macError = macRuleError(form.version.trim(), form.mac);
  if (macError) errors.mac = macError;
  if (form.sections.length > LIMITS.sections) errors.notes = `At most ${LIMITS.sections} note sections are allowed.`;
  const seen = new Set<string>();
  form.sections.forEach((section, i) => validateSection(section, i, seen, errors));
  return errors;
}

export interface ServerFailure {
  status: number;
  message: string;
  details: FieldError[];
}

/**
 * Maps server error details (dotted paths like `notes.Fixes.2`) onto form error keys.
 * Returns a form-level message unless every detail landed on a field of a 422 response.
 */
export function mapServerErrors(
  failure: ServerFailure,
  form: ReleaseFormState,
): { fields: ReleaseFormErrors; form: string | null } {
  const fields: ReleaseFormErrors = {};
  const unmapped: string[] = [];
  for (const detail of failure.details) {
    const [root, section, item] = detail.field.split('.');
    if (['version', 'date', 'mac', 'type'].includes(root) && !section) {
      fields[root] = detail.message;
    } else if (root === 'notes') {
      const i = section === undefined ? -1 : form.sections.findIndex((s) => s.name.trim() === section);
      if (i === -1) fields.notes = detail.message;
      else if (item !== undefined && form.sections[i].items[Number(item)])
        fields[itemErrorKey(i, Number(item))] = detail.message;
      else fields[sectionErrorKey(i)] = detail.message;
    } else {
      unmapped.push(detail.message);
    }
  }
  const allOnFields = failure.status === 422 && Object.keys(fields).length > 0 && unmapped.length === 0;
  return { fields, form: allOnFields ? null : [failure.message, ...unmapped].join(' ') };
}

/** The PUT/POST body fields shared by create and update (trimmed). */
export function formToReleaseBody(form: ReleaseFormState) {
  return {
    type: form.type || null,
    date: form.date,
    mac: form.mac,
    notes: Object.fromEntries(form.sections.map((s) => [s.name.trim(), s.items.map((item) => item.text.trim())])),
  };
}

export function saveButtonLabel(isSaving: boolean, isCreating: boolean): string {
  if (isSaving) return 'Saving…';
  return isCreating ? 'Create release' : 'Save changes';
}
