import { Field } from '../../components/Field';
import { CATEGORIES, LICENSE_TYPES, PLATFORM_VERSIONS, TYPES } from '../../data/components';
import { formatBytes } from '../../lib/format';
import type { StepProps } from './stepProps';
import { LIMITS } from './submitForm';

export function GeneralStep({ form, onChange, controlProps, errorFor }: StepProps) {
  const shortLength = form.short.trim().length;
  return (
    <>
      <Field id="f-name" label="Name" error={errorFor('name')}>
        <input
          {...controlProps('name')}
          value={form.name}
          onChange={onChange('name')}
          placeholder="My Awesome Widget"
          maxLength={80}
          autoComplete="off"
        />
      </Field>
      <div className="row-gap">
        <Field id="f-type" label="Type">
          <select {...controlProps('type')} value={form.type} onChange={onChange('type')}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field id="f-category" label="Category">
          <select {...controlProps('category')} value={form.category} onChange={onChange('category')}>
            {CATEGORIES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        id="f-short"
        label="Short description"
        error={errorFor('short')}
        aside={
          <span id="f-short-count" className={`char-count ${shortLength > LIMITS.shortMax ? 'over' : ''}`}>
            {shortLength}/{LIMITS.shortMax}
          </span>
        }
      >
        <input
          {...controlProps('short', 'f-short-count')}
          value={form.short}
          onChange={onChange('short')}
          maxLength={200}
          placeholder="One sentence shown on the card"
        />
      </Field>
    </>
  );
}

export function PackageStep({ form, onChange, controlProps, errorFor }: StepProps) {
  return (
    <>
      <div className="row-gap">
        <Field id="f-version" label="Version" error={errorFor('version')}>
          <input {...controlProps('version')} value={form.version} onChange={onChange('version')} placeholder="1.0.0" />
        </Field>
        <Field id="f-minPlatform" label="Minimum platform version">
          <select {...controlProps('minPlatform')} value={form.minPlatform} onChange={onChange('minPlatform')}>
            {PLATFORM_VERSIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        id="f-file"
        label="Package file (.mpk or .zip, max 50 MB)"
        error={errorFor('file')}
        aside={
          form.file ? (
            <span id="f-file-meta" className="muted small">
              Selected: {form.file.name} ({formatBytes(form.file.size)})
            </span>
          ) : undefined
        }
      >
        <input
          {...controlProps('file', form.file ? 'f-file-meta' : undefined)}
          type="file"
          accept=".mpk,.zip"
          onChange={onChange('file')}
        />
      </Field>
    </>
  );
}

export function DetailsStep({ form, onChange, controlProps, errorFor }: StepProps) {
  return (
    <>
      <Field id="f-license" label="License">
        <select {...controlProps('license')} value={form.license} onChange={onChange('license')}>
          {LICENSE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field id="f-repo" label="Source repository (optional)" error={errorFor('repo')}>
        <input
          {...controlProps('repo')}
          type="url"
          inputMode="url"
          value={form.repo}
          onChange={onChange('repo')}
          placeholder="https://github.com/…"
        />
      </Field>
      <Field id="f-description" label="Full description (optional)">
        <textarea
          {...controlProps('description')}
          rows={6}
          value={form.description}
          onChange={onChange('description')}
          placeholder="What does it do, how do you configure it, any limitations?"
        />
      </Field>
    </>
  );
}
