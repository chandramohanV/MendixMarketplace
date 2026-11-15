import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { TYPES, CATEGORIES, PLATFORM_VERSIONS, LICENSE_TYPES } from '../data/components';

const STEPS = ['General', 'Package', 'Details', 'Review'];

export default function Submit() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '', type: TYPES[0], category: CATEGORIES[0], short: '', version: '1.0.0', minPlatform: PLATFORM_VERSIONS[1],
    file: '', license: LICENSE_TYPES[0], repo: '', description: '', terms: false,
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'file' ? e.target.files[0]?.name || '' : e.target.value }));

  const validate = () => {
    if (step === 0 && (!form.name.trim() || form.short.trim().length < 10)) return 'Name and a short description (10+ chars) are required.';
    if (step === 1 && (!/^\d+\.\d+\.\d+$/.test(form.version) || !form.file)) return 'Provide a semantic version (e.g. 1.0.0) and a package file.';
    if (step === 3 && !form.terms) return 'You must accept the terms.';
    return '';
  };
  const next = () => {
    const e = validate();
    setErr(e);
    if (e) return;
    if (step === STEPS.length - 1) setDone(true); else setStep(step + 1);
  };

  if (done) {
    return (
      <div className="container page narrow center">
        <div className="empty-icon">🎉</div>
        <h1>Submission received</h1>
        <p className="muted"><b>{form.name}</b> v{form.version} has been submitted for review. You'll be notified once it's approved (demo — nothing was uploaded).</p>
        <Link to="/components" className="btn btn-primary">Back to marketplace</Link>
      </div>
    );
  }

  return (
    <div className="container page narrow">
      <h1>Contribute a component</h1>
      <ol className="stepper">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''}><span>{i < step ? '✓' : i + 1}</span>{s}</li>)}
      </ol>
      <div className="side-card form">
        {step === 0 && <>
          <label>Name<input value={form.name} onChange={set('name')} placeholder="My Awesome Widget" /></label>
          <div className="row-gap">
            <label>Type<select value={form.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Category<select value={form.category} onChange={set('category')}>{CATEGORIES.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          <label>Short description<input value={form.short} onChange={set('short')} maxLength={160} placeholder="One sentence shown on the card" /></label>
        </>}
        {step === 1 && <>
          <div className="row-gap">
            <label>Version<input value={form.version} onChange={set('version')} /></label>
            <label>Minimum platform version<select value={form.minPlatform} onChange={set('minPlatform')}>{PLATFORM_VERSIONS.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          <label>Package file (.mpk)<input type="file" accept=".mpk,.zip" onChange={set('file')} /></label>
          {form.file && <div className="muted small">Selected: {form.file}</div>}
        </>}
        {step === 2 && <>
          <label>License<select value={form.license} onChange={set('license')}>{LICENSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Source repository (optional)<input value={form.repo} onChange={set('repo')} placeholder="https://github.com/…" /></label>
          <label>Full description<textarea rows={6} value={form.description} onChange={set('description')} /></label>
        </>}
        {step === 3 && <>
          <dl className="facts">
            {Object.entries({ Name: form.name, Type: form.type, Category: form.category, Version: form.version, Platform: `${form.minPlatform}+`, License: form.license, Package: form.file }).map(([k, v]) => (
              <Fragment key={k}><dt>{k}</dt><dd>{v || '—'}</dd></Fragment>
            ))}
          </dl>
          <label className="check"><input type="checkbox" checked={form.terms} onChange={set('terms')} /> <span className="check-label">I agree to the <Link to="/guidelines">publishing guidelines</Link></span></label>
        </>}
        {err && <div className="form-error">{err}</div>}
        <div className="row-end">
          {step > 0 && <button className="btn btn-secondary" onClick={() => { setErr(''); setStep(step - 1); }}>Back</button>}
          <button className="btn btn-primary" onClick={next}>{step === STEPS.length - 1 ? 'Submit' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
