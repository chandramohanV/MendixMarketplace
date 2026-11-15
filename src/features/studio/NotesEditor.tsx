import { Field } from '../../components/Field';
import { Icon } from '../../components/icons';
import { LIMITS } from '../../../shared/studio';
import { itemErrorKey, sectionErrorKey, type NoteSectionState } from './releaseFormModel';
import type { ReleaseControlProps } from './releaseFormProps';

/** Edits release notes as named sections of items. */
export function NotesEditor({
  sections,
  onChange,
  nextId,
  errorFor,
  controlProps,
}: {
  sections: NoteSectionState[];
  onChange: (update: (sections: NoteSectionState[]) => NoteSectionState[]) => void;
  nextId: () => number;
  errorFor: (key: string) => string | undefined;
  controlProps: (key: string) => ReleaseControlProps;
}) {
  const updateSection = (index: number, update: (s: NoteSectionState) => NoteSectionState) =>
    onChange((all) => all.map((s, k) => (k === index ? update(s) : s)));
  const notesError = errorFor('notes');

  return (
    <fieldset className="notes-editor">
      <legend>Release notes</legend>
      {notesError && (
        <div className="field-error" id="rf-notes-error">
          {notesError}
        </div>
      )}
      {sections.length === 0 && (
        <p className="muted small">No release notes yet. Add a section such as “New Features” or “Fixes”.</p>
      )}
      {sections.map((section, i) => (
        <div key={section.id} className="notes-section-edit">
          <div className="notes-section-row">
            <Field id={`rf-${sectionErrorKey(i)}`} label={`Section ${i + 1} name`} error={errorFor(sectionErrorKey(i))}>
              <input
                {...controlProps(sectionErrorKey(i))}
                value={section.name}
                placeholder="New Features"
                onChange={(e) => {
                  const name = e.target.value;
                  updateSection(i, (s) => ({ ...s, name }));
                }}
              />
            </Field>
            <button
              type="button"
              className="btn btn-secondary sm"
              onClick={() => onChange((all) => all.filter((_, k) => k !== i))}
              aria-label={`Remove section ${i + 1}`}
            >
              Remove section
            </button>
          </div>
          <ul className="notes-items">
            {section.items.map((item, j) => {
              const itemError = errorFor(itemErrorKey(i, j));
              return (
                <li key={item.id}>
                  <div className={`field ${itemError ? 'has-error' : ''}`}>
                    <div className="item-row">
                      <input
                        {...controlProps(itemErrorKey(i, j))}
                        aria-label={`Section ${i + 1}, item ${j + 1}`}
                        value={item.text}
                        placeholder="Describe the change"
                        onChange={(e) => {
                          const text = e.target.value;
                          updateSection(i, (s) => ({
                            ...s,
                            items: s.items.map((it, k) => (k === j ? { ...it, text } : it)),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => updateSection(i, (s) => ({ ...s, items: s.items.filter((_, k) => k !== j) }))}
                        aria-label={`Remove item ${j + 1} from section ${i + 1}`}
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                    {itemError && (
                      <div className="field-meta">
                        <span className="field-error" id={`rf-${itemErrorKey(i, j)}-error`}>
                          {itemError}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="text-btn link"
            disabled={section.items.length >= LIMITS.itemsPerSection}
            onClick={() => updateSection(i, (s) => ({ ...s, items: [...s.items, { id: nextId(), text: '' }] }))}
          >
            + Add item
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary sm"
        disabled={sections.length >= LIMITS.sections}
        onClick={() => onChange((all) => [...all, { id: nextId(), name: '', items: [{ id: nextId(), text: '' }] }])}
      >
        + Add section
      </button>
      {sections.length >= LIMITS.sections && (
        <span className="muted small"> Maximum of {LIMITS.sections} sections.</span>
      )}
    </fieldset>
  );
}
