// Create (initial = null) or edit a component. Client errors show after the first save attempt;
// server field errors (e.g. a duplicate name) show on the matching field.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Field } from '../../components/Field';
import {
  CATEGORIES,
  INDUSTRIES,
  LICENSE_MODELS,
  LICENSE_TYPES,
  PLATFORM_VERSIONS,
  PUBLISHER_LIST,
  SUPPORT,
  TYPES,
} from '../../data/components';
import { ApiError } from '../../lib/api';
import type { Component } from '../../types';
import { createComponent, updateComponent } from './api';
import {
  EMPTY_COMPONENT_FORM,
  errorsByField,
  formFromComponent,
  validateComponentForm,
  type ComponentFormErrors,
  type ComponentFormField,
  type ComponentFormState,
} from './componentFormModel';

const PUBLISHER_NAMES = PUBLISHER_LIST.map((p) => p.name);

export function ComponentForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Component | null;
  onCancel: () => void;
  onSaved: (component: Component, created: boolean) => void;
}) {
  const isCreating = initial === null;
  const [form, setForm] = useState<ComponentFormState>(() =>
    initial ? formFromComponent(initial) : EMPTY_COMPONENT_FORM,
  );
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ComponentFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validation = validateComponentForm(form);
  const clientErrors = validation.ok || !attempted ? {} : validation.errors;
  const errorFor = (field: ComponentFormField) => serverErrors[field] ?? clientErrors[field];

  const set = <K extends ComponentFormField>(field: K, value: ComponentFormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setServerErrors({});
    setFormError(null);
  };

  const controlProps = (field: ComponentFormField) => ({
    id: `cf-${field}`,
    'aria-invalid': errorFor(field) ? true : undefined,
    'aria-describedby': errorFor(field) ? `cf-${field}-error` : undefined,
  });

  const textField = (field: ComponentFormField, label: string, hint?: ReactNode) => (
    <Field id={`cf-${field}`} label={label} error={errorFor(field)} hint={hint}>
      <input {...controlProps(field)} value={String(form[field])} onChange={(e) => set(field, e.target.value)} />
    </Field>
  );

  const selectField = <K extends ComponentFormField>(field: K, label: string, options: readonly string[]) => (
    <Field id={`cf-${field}`} label={label} error={errorFor(field)}>
      <select
        {...controlProps(field)}
        value={String(form[field])}
        onChange={(e) => set(field, e.target.value as ComponentFormState[K])}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!validation.ok) return;
    setIsSaving(true);
    try {
      const saved = initial
        ? await updateComponent(initial.slug, validation.input)
        : await createComponent(validation.input);
      onSaved(saved, isCreating);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerErrors(errorsByField(err.details));
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Try again.');
      }
      setIsSaving(false);
    }
  };

  return (
    <form className="form component-form" onSubmit={submit} noValidate>
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}
      {textField('name', 'Name')}
      {textField('short', 'Short description')}
      <div className="form-grid">
        {selectField('type', 'Type', TYPES)}
        {selectField('category', 'Category', CATEGORIES)}
        {selectField('industry', 'Industry', INDUSTRIES)}
        {selectField('publisher', 'Publisher', PUBLISHER_NAMES)}
        {selectField('support', 'Support', SUPPORT)}
        {selectField('minPlatform', 'Minimum platform version', PLATFORM_VERSIONS)}
        {selectField('license', 'License model', LICENSE_MODELS)}
        {selectField('licenseType', 'License type', LICENSE_TYPES)}
        {textField('price', 'Price', 'Whole number; 0 for free components.')}
        {textField('version', 'Version', 'For example 1.0.0. A new version adds a release entry.')}
      </div>
      {textField('tags', 'Tags', 'Separate tags with commas.')}
      <Field id="cf-features" label="Features" error={errorFor('features')} hint="One feature per line.">
        <textarea
          {...controlProps('features')}
          rows={4}
          value={form.features}
          onChange={(e) => set('features', e.target.value)}
        />
      </Field>
      {textField('repo', 'Repository URL', 'Optional. Must start with https://.')}
      <label className="check">
        <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
        Featured on the Explore page
      </label>
      <div className="row-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {saveLabel(isCreating, isSaving)}
        </button>
      </div>
    </form>
  );
}

function saveLabel(isCreating: boolean, isSaving: boolean): string {
  if (isSaving) return 'Saving…';
  return isCreating ? 'Create component' : 'Save changes';
}
