// Admin component form model. Pure: no React. Validation reuses the shared API schema, so the browser
// and the server always agree.
import { ComponentInputSchema, type ComponentInput } from '../../../shared/components';
import type { FieldError } from '../../../shared/studio';
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
import type { Component, ComponentType, LicenseModel, SupportLevel } from '../../types';

/** Form values as the inputs hold them: numbers and lists are edited as text. */
export interface ComponentFormState {
  name: string;
  type: ComponentType;
  category: string;
  industry: string;
  publisher: string;
  support: SupportLevel;
  license: LicenseModel;
  licenseType: string;
  price: string;
  version: string;
  minPlatform: string;
  short: string;
  featured: boolean;
  /** Comma-separated. */
  tags: string;
  /** One feature per line. */
  features: string;
  repo: string;
}

export type ComponentFormField = keyof ComponentFormState;
export type ComponentFormErrors = Partial<Record<ComponentFormField, string>>;

export const EMPTY_COMPONENT_FORM: ComponentFormState = {
  name: '',
  type: TYPES[0],
  category: CATEGORIES[0],
  industry: INDUSTRIES[0],
  publisher: PUBLISHER_LIST[0].name,
  support: SUPPORT[0],
  license: LICENSE_MODELS[0],
  licenseType: LICENSE_TYPES[0],
  price: '0',
  version: '1.0.0',
  minPlatform: PLATFORM_VERSIONS[1],
  short: '',
  featured: false,
  tags: '',
  features: '',
  repo: '',
};

export function formFromComponent(c: Component): ComponentFormState {
  return {
    name: c.name,
    type: c.type,
    category: c.category,
    industry: c.industry,
    publisher: c.publisher,
    support: c.support,
    license: c.license,
    licenseType: c.licenseType,
    price: String(c.price),
    version: c.version,
    minPlatform: c.minPlatform,
    short: c.short,
    featured: c.featured,
    tags: c.tags.join(', '),
    features: c.features.join('\n'),
    repo: c.repo ?? '',
  };
}

const splitList = (text: string, separator: RegExp): string[] =>
  text
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

/** Converts form text into the API body shape (before validation). */
export function toComponentBody(form: ComponentFormState): Record<keyof ComponentInput, unknown> {
  const priceText = form.price.trim();
  return {
    ...form,
    price: priceText === '' ? Number.NaN : Number(priceText),
    tags: splitList(form.tags, /,/),
    features: splitList(form.features, /\n/),
    repo: form.repo.trim() || null,
  };
}

const isFormField = (key: string): key is ComponentFormField => key in EMPTY_COMPONENT_FORM;

/** Maps dotted error paths (e.g. `tags.2`) to the form field that holds them; the first error per field wins. */
export function errorsByField(details: FieldError[]): ComponentFormErrors {
  const errors: ComponentFormErrors = {};
  for (const { field, message } of details) {
    const key = field.split('.')[0];
    if (isFormField(key) && !errors[key]) errors[key] = message;
  }
  return errors;
}

export type ComponentFormResult = { ok: true; input: ComponentInput } | { ok: false; errors: ComponentFormErrors };

export function validateComponentForm(form: ComponentFormState): ComponentFormResult {
  const result = ComponentInputSchema.safeParse(toComponentBody(form));
  if (result.success) return { ok: true, input: result.data };
  const details = result.error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  return { ok: false, errors: errorsByField(details) };
}
