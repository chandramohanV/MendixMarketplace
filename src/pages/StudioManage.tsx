import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  defaultMac, isRealDate, LIMITS, macRuleError, RELEASE_TYPE_VALUES, todayISO, VERSION_RE,
  type ReleaseListItem, type ReleaseType, type StudioRelease,
} from '../../shared/studio';
import { ApiError, createRelease, deleteRelease, getRelease, listReleases, updateRelease } from '../api/studio';
import { useApiQuery } from '../hooks/useApiQuery';
import { longDate } from '../lib/studioFormat';
import { useStore } from '../store';
import { Icon } from '../components/icons';
import { Modal, SkeletonRows, TypeBadge } from '../components/studio-ui';

const PAGE_SIZE = 20;

// ---------- release form ----------
interface ItemState { id: number; text: string }
interface SectionState { id: number; name: string; items: ItemState[] }
interface FormState { version: string; type: ReleaseType | ''; date: string; mac: boolean; macTouched: boolean; sections: SectionState[] }
type Errors = Record<string, string>;

let uid = 0;
const nextId = () => ++uid;
const sectionKey = (i: number) => `section-${i}-name`;
const itemKey = (i: number, j: number) => `section-${i}-item-${j}`;

function toForm(r: StudioRelease | null): FormState {
  if (!r) return { version: '', type: '', date: todayISO(), mac: false, macTouched: false, sections: [] };
  return {
    version: r.version, type: r.type ?? '', date: r.date, mac: r.mac, macTouched: true,
    sections: Object.entries(r.notes).map(([name, items]) => ({ id: nextId(), name, items: items.map((text) => ({ id: nextId(), text })) })),
  };
}

function validate(f: FormState, creating: boolean): Errors {
  const e: Errors = {};
  if (creating && !VERSION_RE.test(f.version.trim())) e.version = 'Use semantic versioning, for example 11.2.0.';
  if (!isRealDate(f.date)) e.date = 'Enter a real date.';
  else if (f.date > todayISO()) e.date = 'Release date cannot be in the future.';
  const macErr = macRuleError(f.version.trim(), f.mac);
  if (macErr) e.mac = macErr;
  if (f.sections.length > LIMITS.sections) e.notes = `At most ${LIMITS.sections} note sections are allowed.`;
  const seen = new Set<string>();
  f.sections.forEach((s, i) => {
    const name = s.name.trim();
    if (!name) e[sectionKey(i)] = 'Section name is required.';
    else if (name.length > LIMITS.sectionNameLength) e[sectionKey(i)] = `At most ${LIMITS.sectionNameLength} characters.`;
    else if (seen.has(name.toLowerCase())) e[sectionKey(i)] = 'Section names must be unique.';
    seen.add(name.toLowerCase());
    if (s.items.length === 0) e[sectionKey(i)] ??= 'Add at least one item or remove the section.';
    if (s.items.length > LIMITS.itemsPerSection) e[sectionKey(i)] ??= `At most ${LIMITS.itemsPerSection} items per section.`;
    s.items.forEach((it, j) => {
      const t = it.text.trim();
      if (!t) e[itemKey(i, j)] = 'Note items cannot be empty.';
      else if (t.length > LIMITS.itemLength) e[itemKey(i, j)] = `At most ${LIMITS.itemLength} characters (${t.length}).`;
    });
  });
  return e;
}

/** Maps server `details` (e.g. `notes.Fixes.2`) onto form error keys; anything unmapped becomes form-level. */
function mapServerErrors(err: ApiError, f: FormState): { fields: Errors; form: string | null } {
  const fields: Errors = {};
  const unmapped: string[] = [];
  for (const d of err.details) {
    const [root, section, item] = d.field.split('.');
    if (['version', 'date', 'mac', 'type'].includes(root) && !section) { fields[root] = d.message; continue; }
    if (root === 'notes') {
      const i = section === undefined ? -1 : f.sections.findIndex((s) => s.name.trim() === section);
      if (i === -1) fields.notes = d.message;
      else if (item !== undefined && f.sections[i].items[Number(item)]) fields[itemKey(i, Number(item))] = d.message;
      else fields[sectionKey(i)] = d.message;
      continue;
    }
    unmapped.push(d.message);
  }
  const hasFields = Object.keys(fields).length > 0;
  return { fields, form: err.status === 422 && hasFields && !unmapped.length ? null : [err.message, ...unmapped].join(' ') };
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {(error || hint) && <div className="field-meta">{error ? <span className="field-error" id={`${id}-error`}>{error}</span> : <span className="muted">{hint}</span>}</div>}
    </div>
  );
}

function ReleaseForm({ initial, onCancel, onSaved }: { initial: StudioRelease | null; onCancel: () => void; onSaved: (r: StudioRelease, created: boolean) => void }) {
  const creating = initial === null;
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const clientErrors = validate(form, creating);
  const show = (k: string) => serverErrors[k] ?? (attempted || touched[k] ? clientErrors[k] : undefined);
  const a11y = (k: string) => ({
    id: `rf-${k}`,
    'aria-invalid': show(k) ? true : undefined,
    'aria-describedby': show(k) ? `rf-${k}-error` : undefined,
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
  });

  // Any edit clears the server's verdict on the affected form.
  const update = (fn: (f: FormState) => FormState) => { setForm(fn); setServerErrors({}); setFormError(null); };
  const updateSection = (i: number, fn: (s: SectionState) => SectionState) => update((f) => ({ ...f, sections: f.sections.map((s, k) => (k === i ? fn(s) : s)) }));

  const focusFirstInvalid = () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setAttempted(true);
    if (Object.keys(clientErrors).length) { focusFirstInvalid(); return; }
    const notes = Object.fromEntries(form.sections.map((s) => [s.name.trim(), s.items.map((it) => it.text.trim())]));
    const body = { type: form.type || null, date: form.date, mac: form.mac, notes };
    setSaving(true);
    try {
      const saved = creating ? await createRelease({ version: form.version.trim(), ...body }) : await updateRelease(initial.version, body);
      onSaved(saved, creating);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(0, 'unknown', 'Something went wrong.');
      const mapped = mapServerErrors(apiErr, form);
      // A duplicate version (409) is reported at form level, as the prompt requires.
      if (apiErr.status === 409) { setFormError(apiErr.message); setServerErrors({}); } else { setServerErrors(mapped.fields); setFormError(mapped.form); }
      setSaving(false);
      focusFirstInvalid();
    }
  };

  const majorBelow10 = VERSION_RE.test(form.version.trim()) && !defaultMac(form.version.trim());

  return (
    <form ref={formRef} className="form release-form" onSubmit={submit} noValidate>
      {formError && <div className="form-alert" role="alert">{formError}</div>}
      <div className="row-gap">
        <Field id="rf-version" label="Version" error={show('version')} hint={creating ? 'For example 11.17.1' : 'The version cannot be changed.'}>
          <input {...a11y('version')} value={form.version} readOnly={!creating} placeholder="11.17.1" autoComplete="off"
            onChange={(e) => { const v = e.target.value; update((f) => ({ ...f, version: v, mac: f.macTouched ? f.mac : defaultMac(v.trim()) })); }} />
        </Field>
        <Field id="rf-type" label="Release type" error={show('type')}>
          <select {...a11y('type')} value={form.type} onChange={(e) => { const v = e.target.value as ReleaseType | ''; update((f) => ({ ...f, type: v })); }}>
            <option value="">None</option>
            {RELEASE_TYPE_VALUES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="row-gap">
        <Field id="rf-date" label="Release date" error={show('date')}>
          <input {...a11y('date')} type="date" max={todayISO()} value={form.date} onChange={(e) => { const v = e.target.value; update((f) => ({ ...f, date: v })); }} />
        </Field>
        <div className={`field ${show('mac') ? 'has-error' : ''}`}>
          <span className="field-label">Downloads</span>
          <label className="check mac-check">
            <input type="checkbox" {...a11y('mac')} checked={form.mac} onChange={(e) => { const v = e.target.checked; update((f) => ({ ...f, mac: v, macTouched: true })); }} />
            <span className="check-label">Available for Mac (Beta)</span>
          </label>
          <div className="field-meta">
            {show('mac') ? <span className="field-error" id="rf-mac-error">{show('mac')}</span> : <span className="muted">{majorBelow10 ? 'Studio 9 and earlier: Windows only.' : 'Windows is always available.'}</span>}
          </div>
        </div>
      </div>

      <fieldset className="notes-editor">
        <legend>Release notes</legend>
        {show('notes') && <div className="field-error" id="rf-notes-error">{show('notes')}</div>}
        {form.sections.length === 0 && <p className="muted small">No release notes yet. Add a section such as “New Features” or “Fixes”.</p>}
        {form.sections.map((s, i) => (
          <div key={s.id} className="notes-section-edit">
            <div className="notes-section-row">
              <Field id={`rf-${sectionKey(i)}`} label={`Section ${i + 1} name`} error={show(sectionKey(i))}>
                <input {...a11y(sectionKey(i))} value={s.name} placeholder="New Features" onChange={(e) => { const v = e.target.value; updateSection(i, (x) => ({ ...x, name: v })); }} />
              </Field>
              <button type="button" className="btn btn-secondary sm" onClick={() => update((f) => ({ ...f, sections: f.sections.filter((_, k) => k !== i) }))} aria-label={`Remove section ${i + 1}`}>Remove section</button>
            </div>
            <ul className="notes-items">
              {s.items.map((it, j) => (
                <li key={it.id}>
                  <div className={`field ${show(itemKey(i, j)) ? 'has-error' : ''}`}>
                    <div className="item-row">
                      <input {...a11y(itemKey(i, j))} aria-label={`Section ${i + 1}, item ${j + 1}`} value={it.text} placeholder="Describe the change"
                        onChange={(e) => { const v = e.target.value; updateSection(i, (x) => ({ ...x, items: x.items.map((y, k) => (k === j ? { ...y, text: v } : y)) })); }} />
                      <button type="button" className="icon-btn" onClick={() => updateSection(i, (x) => ({ ...x, items: x.items.filter((_, k) => k !== j) }))} aria-label={`Remove item ${j + 1} from section ${i + 1}`}><Icon name="close" /></button>
                    </div>
                    {show(itemKey(i, j)) && <div className="field-meta"><span className="field-error" id={`rf-${itemKey(i, j)}-error`}>{show(itemKey(i, j))}</span></div>}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="text-btn link" disabled={s.items.length >= LIMITS.itemsPerSection}
              onClick={() => updateSection(i, (x) => ({ ...x, items: [...x.items, { id: nextId(), text: '' }] }))}>+ Add item</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary sm" disabled={form.sections.length >= LIMITS.sections}
          onClick={() => update((f) => ({ ...f, sections: [...f.sections, { id: nextId(), name: '', items: [{ id: nextId(), text: '' }] }] }))}>+ Add section</button>
        {form.sections.length >= LIMITS.sections && <span className="muted small"> Maximum of {LIMITS.sections} sections.</span>}
      </fieldset>

      <div className="row-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving || undefined}>{saving ? 'Saving…' : creating ? 'Create release' : 'Save changes'}</button>
      </div>
    </form>
  );
}

function EditReleaseDialog({ version, onClose, onSaved }: { version: string; onClose: () => void; onSaved: (r: StudioRelease, created: boolean) => void }) {
  const { data, error, loading, reload } = useApiQuery(`release:${version}`, (signal) => getRelease(version, signal));
  return (
    <Modal title={`Edit Studio ${version}`} onClose={onClose} wide>
      {loading && <p className="muted" role="status">Loading release…</p>}
      {error && <div className="inline-error" role="alert"><span>{error.message}</span><button className="btn btn-secondary sm" onClick={reload}>Retry</button></div>}
      {data && <ReleaseForm initial={data} onCancel={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function DeleteDialog({ release, onClose, onDeleted }: { release: ReleaseListItem; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteRelease(release.version);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };
  return (
    <Modal title={`Delete Studio ${release.version}?`} onClose={onClose}>
      <p>This permanently removes the release and its notes from the download page. This can't be undone.</p>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <div className="row-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy} aria-busy={busy || undefined}>{busy ? 'Deleting…' : 'Delete release'}</button>
      </div>
    </Modal>
  );
}

// ---------- page ----------
type DialogState = { kind: 'create' } | { kind: 'edit'; version: string } | { kind: 'delete'; release: ReleaseListItem } | null;

export default function StudioManage() {
  const { notify } = useStore();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    const id = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 250);
    return () => clearTimeout(id);
  }, [qInput]);

  const list = useApiQuery(JSON.stringify({ q, page }), (signal) => listReleases({ q: q || undefined, page, pageSize: PAGE_SIZE }, signal));
  const shown = list.data ?? list.previous;
  const total = shown?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSaved = (r: StudioRelease, created: boolean) => {
    setDialog(null);
    notify(created ? `Release ${r.version} created` : `Release ${r.version} updated`);
    list.reload();
  };

  return (
    <div className="manage">
      <nav className="breadcrumbs"><Link to="/studio">Studio</Link> / <span>Manage releases</span></nav>
      <div className="manage-head">
        <div>
          <h1>Manage releases</h1>
          <p className="muted">Create, edit and delete Studio releases. Changes are saved through the Studio API and show up on the download page immediately.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>+ New release</button>
      </div>

      <div className="release-controls">
        <div className="input-icon">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search by Version Number" aria-label="Search by version number" />
          <Icon name="search" />
        </div>
      </div>

      <div className="table-wrap">
        <table className="release-table manage-table" aria-busy={list.loading || undefined}>
          <thead>
            <tr><th scope="col">Version</th><th scope="col">Release date</th><th scope="col">Mac</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {list.loading && <SkeletonRows rows={8} cols={4} />}
            {list.error && (
              <tr><td colSpan={4} className="no-rows">
                <div className="inline-error center-row" role="alert"><span>Couldn't load releases. {list.error.message}</span><button className="btn btn-secondary sm" onClick={list.reload}>Retry</button></div>
              </td></tr>
            )}
            {list.data?.items.map((r) => (
              <tr key={r.version}>
                <td data-label="Version"><span className="version-text">{r.version}</span> <TypeBadge type={r.type} /></td>
                <td data-label="Released">{longDate(r.date)}</td>
                <td data-label="Mac">{r.mac ? 'Yes' : '—'}</td>
                <td className="actions-cell"><div className="actions">
                  <button className="btn btn-secondary sm" onClick={() => setDialog({ kind: 'edit', version: r.version })} aria-label={`Edit ${r.version}`}>Edit</button>
                  <button className="btn btn-secondary sm" onClick={() => setDialog({ kind: 'delete', release: r })} aria-label={`Delete ${r.version}`}>Delete</button>
                </div></td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 && <tr><td colSpan={4} className="no-rows">No releases match “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className="table-pager" aria-label="Release table pages">
        <button className="icon-btn" disabled={page === 1 || list.loading} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
        <span className="pager-status" aria-live="polite">{list.loading ? 'Loading…' : `${total ? (page - 1) * PAGE_SIZE + 1 : 0} to ${Math.min(page * PAGE_SIZE, total)} of ${total}`}</span>
        <button className="icon-btn" disabled={page >= pages || list.loading} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="chevronRight" /></button>
      </nav>

      {dialog?.kind === 'create' && (
        <Modal title="New release" onClose={() => setDialog(null)} wide>
          <ReleaseForm initial={null} onCancel={() => setDialog(null)} onSaved={onSaved} />
        </Modal>
      )}
      {dialog?.kind === 'edit' && <EditReleaseDialog version={dialog.version} onClose={() => setDialog(null)} onSaved={onSaved} />}
      {dialog?.kind === 'delete' && (
        <DeleteDialog release={dialog.release} onClose={() => setDialog(null)}
          onDeleted={() => { setDialog(null); notify(`Release ${dialog.release.version} deleted`); list.reload(); }} />
      )}
    </div>
  );
}
