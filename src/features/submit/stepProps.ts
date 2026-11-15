import type { ChangeEvent } from 'react';
import type { FieldKey, FormState } from './submitForm';

export type ControlElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** id, ARIA wiring and blur tracking for a form control. */
export interface ControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  onBlur: () => void;
}

/** What every form step receives from SubmitPage. */
export interface StepProps {
  form: FormState;
  onChange: (key: FieldKey) => (e: ChangeEvent<ControlElement>) => void;
  controlProps: (key: FieldKey, extraDescribedBy?: string) => ControlProps;
  /** The error to show for a field right now (only after it was touched or its step was attempted). */
  errorFor: (key: FieldKey) => string | undefined;
}

/** DOM id of a field's control; errors use `${controlId(key)}-error`. */
export const controlId = (key: FieldKey): string => `f-${key}`;
